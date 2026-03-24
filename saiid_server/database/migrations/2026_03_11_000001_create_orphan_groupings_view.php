<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migration.
     */
    public function up(): void
    {
        // Create database view for orphan groupings
        DB::statement("
            CREATE VIEW orphan_groupings AS
            SELECT 
                SUBSTRING_INDEX(SUBSTRING_INDEX(current_address, ',', 1), ' ', -1) as governorate,
                CASE 
                    WHEN current_address LIKE '%,%' AND current_address NOT LIKE '%,%,%' THEN
                        SUBSTRING_INDEX(SUBSTRING_INDEX(current_address, ',', -1), ' ', 2)
                    WHEN current_address LIKE '%,%,%' THEN
                        SUBSTRING_INDEX(SUBSTRING_INDEX(current_address, ',', -2), ' ', 2)
                    ELSE 'غير محدد'
                END as district,
                COUNT(*) as orphan_count,
                AVG(
                    CASE 
                        WHEN orphan_birth_date IS NOT NULL 
                        THEN TIMESTAMPDIFF(YEAR, orphan_birth_date, CURDATE())
                        ELSE NULL 
                    END
                ) as average_age,
                SUM(CASE WHEN orphan_gender = 'ذكر' THEN 1 ELSE 0 END) as male_count,
                SUM(CASE WHEN orphan_gender = 'أنثى' THEN 1 ELSE 0 END) as female_count,
                SUM(COALESCE(number_of_brothers, 0)) as total_brothers,
                SUM(COALESCE(number_of_sisters, 0)) as total_sisters,
                SUM(CASE WHEN health_status IS NOT NULL AND health_status != 'سليم' AND health_status != '' THEN 1 ELSE 0 END) as health_issues_count,
                MAX(
                    CASE 
                        WHEN orphan_birth_date IS NOT NULL 
                        THEN TIMESTAMPDIFF(YEAR, orphan_birth_date, CURDATE())
                        ELSE NULL 
                    END
                ) as max_age,
                MIN(
                    CASE 
                        WHEN orphan_birth_date IS NOT NULL 
                        THEN TIMESTAMPDIFF(YEAR, orphan_birth_date, CURDATE())
                        ELSE NULL 
                    END
                ) as min_age,
                SUM(CASE WHEN is_enrolled_in_memorization_center = 1 THEN 1 ELSE 0 END) as in_memorization_count,
                MAX(created_at) as created_at,
                MAX(updated_at) as updated_at
            FROM orphans
            WHERE current_address IS NOT NULL 
               AND current_address != ''
            GROUP BY governorate, district
            ORDER BY orphan_count DESC
        ");
    }

    /**
     * Reverse the migration.
     */
    public function down(): void
    {
        DB::statement("DROP VIEW IF EXISTS orphan_groupings");
    }
};
