<?php
// app/Services/CurrencyConversionService.php

namespace App\Services;

use App\Enums\ProjectStatusGroup;
use App\Models\ProjectProposal;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class CurrencyConversionService
{
    /**
     * @return array{success: bool, data?: array, error?: string, code?: int}
     */
    public function convertToShekel(
        int $projectId,
        User $user,
        float $exchangeRate,
        float $transferDiscountPercentage = 0,
    ): array {
        $project = ProjectProposal::findOrFail($projectId);

        // Validate conversion eligibility
        $eligibilityError = $this->validateEligibility($project, $user);
        if ($eligibilityError) {
            return $eligibilityError;
        }

        if ($exchangeRate <= 0) {
            return $this->fail('سعر الصرف يجب أن يكون أكبر من صفر', 422);
        }

        // Perform conversion
        $netAmountShekel = $project->convertToShekel(
            $exchangeRate,
            $user->id,
            $transferDiscountPercentage
        );

        // Timeline
        $note = "تم تحويل المبلغ الصافي للشيكل: {$project->net_amount} USD × {$exchangeRate} = {$netAmountShekel} ILS";
        if ($transferDiscountPercentage > 0) {
            $note .= " (تم خصم نسبة النقل: {$transferDiscountPercentage}%)";
        }

        $project->recordStatusChange(
            $project->status,
            $project->status,
            $user->id,
            $note
        );

        return [
            'success' => true,
            'data'    => [
                'net_amount_usd'       => $project->net_amount,
                'shekel_exchange_rate'  => $project->shekel_exchange_rate,
                'net_amount_shekel'     => $project->net_amount_shekel,
                'converted_at'         => $project->shekel_converted_at,
            ],
        ];
    }

    private function validateEligibility(ProjectProposal $project, User $user): ?array
    {
        $isOrphanCoordinator = $user->role === 'orphan_sponsor_coordinator';
        $isSponsorship = $project->isSponsorshipProject();

        if ($isOrphanCoordinator && $isSponsorship) {
            // Sponsorship coordinator: all statuses except cancelled
            if ($project->status === 'ملغى') {
                return $this->fail('لا يمكن التحويل للشيكل - المشروع ملغى', 422);
            }
            return null;
        }

        // Others: only "جديد" or "قيد التوريد"
        if (!in_array($project->status, ProjectStatusGroup::ALLOWED_FOR_SHEKEL_CONVERSION)) {
            return $this->fail(
                'المشروع يجب أن يكون في حالة جديد أو قيد التوريد. الحالة الحالية: ' . $project->status,
                422
            );
        }

        return null;
    }

    private function fail(string $message, int $code): array
    {
        return ['success' => false, 'error' => $message, 'code' => $code];
    }
}