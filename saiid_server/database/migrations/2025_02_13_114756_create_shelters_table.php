<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateSheltersTable extends Migration
{
    public function up()
    {
        if (Schema::hasTable('shelters')) {
            return;
        }
        
        Schema::create('shelters', function (Blueprint $table) {
            // Manager Information
            $table->string('manager_id_number')->primary();
            $table->string('manager_name');
            $table->string('manager_phone', 50);
            $table->string('manager_alternative_phone', 50)->nullable();
            $table->text('manager_job_description');
            // Deputy Manager Information
            $table->string('deputy_manager_name');
            $table->string('deputy_manager_id_number')->unique();
            $table->string('deputy_manager_phone', 50);
            $table->string('deputy_manager_alternative_phone', 50)->nullable();
            $table->text('deputy_manager_job_description');
            // Shelter Information
            $table->string('camp_name');
            $table->enum('governorate', ['محافظة الشمال', 'محافظة غزة', 'محافظة الوسطى', 'محافظة خانيونس', 'محافظة رفح']);
            $table->string('district');
            $table->text('detailed_address');
            $table->integer('tents_count');
            $table->integer('families_count');
            $table->string('excel_sheet');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('shelters');
    }
}
