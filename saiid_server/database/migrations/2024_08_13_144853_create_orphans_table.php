<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateOrphansTable extends Migration
{
    public function up()
    {
        Schema::create('orphans', function (Blueprint $table) {
            $table->string('orphan_id_number')->primary();
            $table->string('orphan_full_name');
            $table->date('orphan_birth_date');
            $table->enum('orphan_gender', ['ذكر', 'أنثى']);
            $table->enum('health_status', ['جيدة', 'مريض']);
            $table->text('disease_description')->nullable();
            $table->enum('original_address', ['محافظة الشمال', 'محافظة غزة', 'محافظة الوسطى', 'محافظة خانيونس', 'محافظة رفح']);
            $table->enum('current_address', ['محافظة الشمال', 'محافظة غزة', 'محافظة الوسطى', 'محافظة خانيونس', 'محافظة رفح']);
            $table->text('address_details');
            $table->integer('number_of_brothers')->nullable();
            $table->integer('number_of_sisters')->nullable();
            $table->enum('is_enrolled_in_memorization_center', ['نعم', 'لا']);
            $table->string('orphan_photo')->nullable();

            $table->string('guardian_id_number');
            $table->string('guardian_full_name');
            $table->string('guardian_relationship');
            $table->string('guardian_phone_number', 50);
            $table->string('alternative_phone_number', 50)->nullable();

            $table->string('deceased_father_full_name');
            $table->date('deceased_father_birth_date');
            $table->date('death_date');
            $table->enum('death_cause', ['شهيد حرب', 'وفاة طبيعية', 'وفاة بسبب المرض']);
            $table->string('previous_father_job')->nullable();
            $table->string('death_certificate');

            $table->string('mother_full_name');
            $table->string('mother_id_number');
            $table->enum('is_mother_deceased', ['نعم', 'لا']);
            $table->date('mother_birth_date');
            $table->date('mother_death_date')->nullable();
            $table->string('mother_death_certificate')->nullable();
            $table->enum('mother_status', ['أرملة', 'متزوجة']);
            $table->string('mother_job');

            $table->integer('beneficiary_count')->default(0)->comment('عدد مشاريع الكفالة التي استفاد منها');
            $table->string('data_approval_name');
            $table->timestamps();
        });
    }

    public function down()
    {
        Schema::dropIfExists('orphans');
    }
}
