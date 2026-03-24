<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('notification_replies', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('notification_id');
            $table->unsignedBigInteger('replied_by');
            $table->text('message');
            $table->text('rejection_reason');
            $table->timestamps();
            
            $table->foreign('notification_id')->references('id')->on('notifications')->onDelete('cascade');
            $table->foreign('replied_by')->references('id')->on('users')->onDelete('cascade');
            
            $table->index('notification_id');
            $table->index('replied_by');
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('notification_replies');
    }
};

