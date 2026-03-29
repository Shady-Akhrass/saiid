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
        Schema::create('project_proposals', function (Blueprint $table) {
            $table->id();
            
            // معلومات أساسية
            $table->string('serial_number')->unique(); // رقم تسلسلي
            $table->string('donor_code')->nullable(); // كود المتبرع
            $table->text('project_description'); // وصف المشروع
            $table->string('donor_name'); // الجهة المتبرعة
            $table->enum('project_type', ['إغاثي', 'تنموي', 'طبي', 'تعليمي']); // نوع المشروع
            
            // المعلومات المالية
            $table->decimal('donation_amount', 15, 2); // مبلغ التبرع
            $table->unsignedBigInteger('currency_id'); // العملة
            $table->decimal('exchange_rate', 10, 4); // سعر الصرف المستخدم
            $table->decimal('amount_in_usd', 15, 2); // المبلغ بالدولار (حسابي)
            $table->decimal('admin_discount_percentage', 5, 2)->default(0); // نسبة الخصم الإداري
            $table->decimal('discount_amount', 15, 2)->default(0); // قيمة الخصم (حسابي)
            $table->decimal('net_amount', 15, 2); // المبلغ الصافي (حسابي)
            
            // معلومات التنفيذ
            $table->integer('quantity')->nullable(); // الكمية
            $table->integer('estimated_duration_days')->nullable(); // مدة التنفيذ المقترحة
            $table->enum('status', [
                'جديد',
                'قيد التوزيع',
                'جاهز للتنفيذ',
                'تم اختيار المخيم',
                'قيد التنفيذ',
                'منفذ',
                'في المونتاج',
                'تم المونتاج',
                'وصل للمتبرع',
                'ملغى',
                'معاد مونتاجه'
            ])->default('جديد');
            
            // التوزيع
            $table->unsignedBigInteger('assigned_to_team_id')->nullable();
            $table->unsignedBigInteger('assigned_photographer_id')->nullable();
            $table->unsignedBigInteger('assigned_by')->nullable();
            $table->date('assignment_date')->nullable();
            
            // المخيم والتنفيذ
            $table->string('shelter_id')->nullable(); // FK للمخيم
            $table->date('execution_date')->nullable();
            $table->date('media_received_date')->nullable();
            $table->date('montage_start_date')->nullable();
            $table->date('montage_completed_date')->nullable();
            $table->date('sent_to_donor_date')->nullable();
            
            // الربط مع النظام القديم
            $table->boolean('transferred_to_projects')->default(false);
            $table->unsignedBigInteger('project_id')->nullable(); // FK لجدول projects القديم
            
            // معلومات إضافية
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->timestamps();

            // Foreign keys
            $table->foreign('currency_id')->references('id')->on('currencies')->onDelete('restrict');
            $table->foreign('assigned_to_team_id')->references('id')->on('teams')->onDelete('set null');
            $table->foreign('assigned_photographer_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('assigned_by')->references('id')->on('users')->onDelete('set null');
            $table->foreign('shelter_id')->references('manager_id_number')->on('shelters')->onDelete('set null');
            $table->foreign('project_id')->references('id')->on('projects')->onDelete('set null');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('restrict');
            
            // Indexes for better performance
            $table->index('status');
            $table->index('project_type');
            $table->index('serial_number');
            $table->index('created_by');
            $table->index('assigned_to_team_id');
            $table->index('shelter_id');
            $table->index('transferred_to_projects');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('project_proposals');
    }
};
