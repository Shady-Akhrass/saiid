<?php

namespace App\Http\Controllers;

use App\Models\ProjectProposal;
use App\Models\WarehouseItem;
use App\Models\ProjectWarehouseItem;
use App\Models\User;
use App\Models\Notification;
use App\Helpers\NotificationHelper;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ProjectWarehouseController extends Controller
{
    /**
     * عرض سلة التسوق للمشروع
     * GET /api/projects/{projectId}/warehouse
     */
    public function getProjectCart($projectId)
    {
        // ✅ تحميل المشروع مع الحقول المطلوبة بما فيها surplus_category_id
        $project = ProjectProposal::select([
            'id', 'serial_number', 'project_description', 'donor_code', 'internal_code', 'net_amount',
            'net_amount_shekel', 'shekel_exchange_rate', 'quantity', 'status',
            'surplus_category_id', 'surplus_amount', 'has_deficit', 'unit_cost', 'supply_cost'
        ])
        ->with([
            'warehouseItems.warehouseItem',
            'surplusCategory:id,name' // ✅ إضافة surplusCategory relationship
        ])
        ->find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }

        // ✅ إعادة تحميل العلاقة للتأكد من تحميلها بشكل صحيح
        $project->load('surplusCategory:id,name');

        // ✅ تسجيل للتحقق من القيمة (للتشخيص)
        \Log::info('getProjectCart - Surplus Category', [
            'project_id' => $projectId,
            'surplus_category_id' => $project->surplus_category_id,
            'surplus_category_loaded' => $project->surplusCategory ? 'yes' : 'no',
            'surplus_category_name' => $project->surplusCategory ? $project->surplusCategory->name : null,
        ]);

        // إذا كان التوريد مؤكد، نستخدم التكلفة الفعلية
        $isConfirmed = $project->status === 'تم التوريد';
        $unitCost = $isConfirmed ? $project->calculateUnitCost() : $project->calculateExpectedUnitCost();
        $projectQuantity = $project->quantity ?? 0;
        
        // استخدام 1 كحد أدنى لحساب التكلفة للعرض
        $quantityForCalculation = max($projectQuantity, 1);
        $supplyCost = round($unitCost * $quantityForCalculation, 2);
        
        // تحديد المبلغ المتاح (شيكل أو دولار)
        $availableAmount = $project->getAvailableAmountForSupply();
        $currency = $project->getSupplyCurrency();
        
        // حساب الوافر بناءً على المبلغ المتاح
        $surplus = $availableAmount - $supplyCost;
        $hasDeficit = $surplus < 0;

        $response = [
            'success' => true,
            'data' => [
                'project' => [
                    'id' => $project->id,
                    'serial_number' => $project->serial_number,
                    'donor_code' => $project->donor_code,
                    'internal_code' => $project->internal_code,
                    'project_description' => $project->project_description,
                    'net_amount' => $project->net_amount,
                    'net_amount_shekel' => $project->net_amount_shekel,
                    'shekel_exchange_rate' => $project->shekel_exchange_rate,
                    'quantity' => $project->quantity ?? 0,
                    'status' => $project->status,
                    'surplus_category_id' => $project->surplus_category_id ?? null, // ✅ إضافة surplus_category_id
                    'surplus_category' => $project->surplusCategory ? [ // ✅ إضافة surplusCategory
                        'id' => $project->surplusCategory->id,
                        'name' => $project->surplusCategory->name,
                    ] : null,
                    'surplus_amount' => $project->surplus_amount ?? null, // ✅ إضافة surplus_amount
                    'has_deficit' => $project->has_deficit ?? false, // ✅ إضافة has_deficit
                ],
                'items' => $project->warehouseItems->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'warehouse_item_id' => $item->warehouse_item_id,
                        'item_name' => $item->warehouseItem->item_name,
                        'description' => $item->warehouseItem->description,
                        'quantity_per_unit' => $item->quantity_per_unit,
                        'unit_price' => $item->unit_price,
                        'total_price_per_unit' => $item->total_price_per_unit,
                        'status' => $item->status,
                        'available_in_warehouse' => $item->warehouseItem->quantity_available,
                    ];
                }),
                'summary' => [
                    'unit_cost' => $unitCost,
                    'project_quantity' => $projectQuantity,
                    'quantity_for_calculation' => $quantityForCalculation,
                    'total_supply_cost' => $supplyCost,
                    'available_amount' => $availableAmount,
                    'currency' => $currency,
                    'expected_surplus' => $surplus,
                    'has_deficit' => $hasDeficit,
                    'deficit_amount' => $hasDeficit ? abs($surplus) : 0,
                    'quantity_not_set' => $projectQuantity === 0,
                ]
            ]
        ];

        // إضافة تحذير إذا كان هناك عجز
        if ($hasDeficit) {
            $currencySymbol = $currency === 'ILS' ? '₪' : '$';
            $response['data']['warning'] = "تنبيه: يوجد عجز قدره {$currencySymbol}" . abs($surplus);
        }

        return response()->json($response, 200);
    }

    /**
     * إضافة صنف لسلة المشروع
     * POST /api/projects/{projectId}/warehouse/items
     */
    public function addItemToProject(Request $request, $projectId)
    {
        $project = ProjectProposal::find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }

        // ✅ التحقق من حالة المشروع
        // ✅ منسق الكفالات يمكنه إضافة الأصناف لمشاريع الكفالات حتى "منتهي"
        $user = $request->user();
        $isOrphanSponsorCoordinator = $user->role === 'orphan_sponsor_coordinator';
        $isSponsorshipProject = $project->isSponsorshipProject();
        
        if (!$isOrphanSponsorCoordinator || !$isSponsorshipProject) {
            // ✅ للآخرين: يجب أن يكون في حالة "قيد التوريد"
            if ($project->status !== 'قيد التوريد') {
                return response()->json([
                    'success' => false,
                    'message' => 'يجب أن يكون المشروع في حالة "قيد التوريد" لإضافة الأصناف'
                ], 422);
            }
        } else {
            // ✅ منسق الكفالات: منع فقط "ملغى"
            if ($project->status === 'ملغى') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن إضافة الأصناف - المشروع ملغى'
                ], 422);
            }
        }

        $validator = Validator::make($request->all(), [
            'warehouse_item_id' => 'required|exists:warehouse_items,id',
            'quantity_per_unit' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $warehouseItem = WarehouseItem::find($request->warehouse_item_id);

        // التحقق من أن الصنف نشط
        if (!$warehouseItem->is_active) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف غير نشط'
            ], 422);
        }

        // التحقق من عدم وجود الصنف مسبقاً في السلة
        $existingItem = ProjectWarehouseItem::where('project_proposal_id', $projectId)
            ->where('warehouse_item_id', $request->warehouse_item_id)
            ->where('status', 'pending')
            ->first();

        if ($existingItem) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف موجود بالفعل في السلة'
            ], 422);
        }

        // التحقق من توفر الكمية
        if ($project->quantity && $project->quantity > 0) {
            $totalNeeded = $request->quantity_per_unit * $project->quantity;
            if (!$warehouseItem->hasEnoughStock($totalNeeded)) {
                return response()->json([
                    'success' => false,
                    'error' => 'الكمية غير كافية',
                    'message' => 'الكمية المتوفرة: ' . $warehouseItem->quantity_available . ' فقط',
                    'available_quantity' => $warehouseItem->quantity_available,
                    'required_quantity' => $totalNeeded
                ], 422);
            }
        }

        // إضافة الصنف للسلة
        $projectItem = ProjectWarehouseItem::create([
            'project_proposal_id' => $projectId,
            'warehouse_item_id' => $request->warehouse_item_id,
            'quantity_per_unit' => $request->quantity_per_unit,
            'unit_price' => $warehouseItem->unit_price,
            'status' => 'pending',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة الصنف للسلة بنجاح',
            'data' => $projectItem->load('warehouseItem')
        ], 201);
    }

    /**
     * حذف صنف من سلة المشروع
     * DELETE /api/projects/{projectId}/warehouse/items/{itemId}
     */
    public function removeItemFromProject(Request $request, $projectId, $itemId)
    {
        $projectItem = ProjectWarehouseItem::where('project_proposal_id', $projectId)
            ->where('id', $itemId)
            ->first();

        if (!$projectItem) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف غير موجود في السلة'
            ], 404);
        }

        $project = $projectItem->projectProposal;
        
        // ✅ التحقق من حالة المشروع
        // ✅ منسق الكفالات يمكنه حذف الأصناف لمشاريع الكفالات حتى "منتهي"
        $user = $request->user();
        $isOrphanSponsorCoordinator = $user->role === 'orphan_sponsor_coordinator';
        $isSponsorshipProject = $project->isSponsorshipProject();
        
        if (!$isOrphanSponsorCoordinator || !$isSponsorshipProject) {
            // ✅ للآخرين: منع إذا كان المشروع "منتهي" أو "ملغى"
            if (in_array($project->status, ['منتهي', 'ملغى'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف الأصناف - المشروع ' . $project->status
                ], 422);
            }
        } else {
            // ✅ منسق الكفالات: منع فقط "ملغى"
            if ($project->status === 'ملغى') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن حذف الأصناف - المشروع ملغى'
                ], 422);
            }
        }

        DB::beginTransaction();
        try {
            // ✅ حفظ حالة الصنف قبل الحذف
            $itemStatus = $projectItem->status;
            $isConfirmed = $itemStatus === 'confirmed';
            $itemIdToDelete = $projectItem->id; // حفظ ID قبل الحذف
            
            // ✅ إذا كان الصنف مؤكداً، نعيد الكمية للمخزن قبل الحذف
            if ($isConfirmed) {
                $warehouseItem = $projectItem->warehouseItem;
                if ($warehouseItem && $project->quantity && $project->quantity > 0) {
                    $totalNeeded = $projectItem->quantity_per_unit * $project->quantity;
                    $warehouseItem->addQuantity($totalNeeded, $user->id);
                    
                    Log::info('Returned quantity to warehouse before deleting confirmed item', [
                        'project_id' => $projectId,
                        'item_id' => $itemId,
                        'warehouse_item_id' => $warehouseItem->id,
                        'quantity_returned' => $totalNeeded,
                        'user_id' => $user->id,
                    ]);
                }
            }

            // ✅ حذف الصنف
            $deleted = $projectItem->delete();
            
            // ✅ التحقق من أن الحذف تم بنجاح
            if (!$deleted) {
                throw new \Exception('فشل حذف الصنف من قاعدة البيانات');
            }
            
            // ✅ التحقق من أن الصنف تم حذفه فعلياً
            $verifyDeleted = ProjectWarehouseItem::where('id', $itemIdToDelete)->exists();
            if ($verifyDeleted) {
                throw new \Exception('الصنف لم يتم حذفه من قاعدة البيانات');
            }

            // ✅ إذا كان الصنف مؤكداً، نعيد حساب الوافر/العجز
            if ($isConfirmed) {
                $project->recordSurplus($user->id, 'تم حذف صنف مؤكد من التوريد');
            }

            DB::commit();

            // ✅ مسح cache للمشاريع والمخازن بعد الحذف
            $this->clearProjectsCache();

            Log::info('Item deleted successfully from project', [
                'project_id' => $projectId,
                'item_id' => $itemIdToDelete,
                'status' => $itemStatus,
                'user_id' => $user->id,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'تم حذف الصنف من السلة بنجاح',
                'deleted_item_id' => $itemIdToDelete
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            
            Log::error('Error deleting item from project', [
                'project_id' => $projectId,
                'item_id' => $itemId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء حذف الصنف',
                'error' => config('app.debug') ? $e->getMessage() : 'يرجى المحاولة مرة أخرى'
            ], 500);
        }
    }

    /**
     * تحديث كمية صنف في السلة
     * PATCH /api/projects/{projectId}/warehouse/items/{itemId}
     */
    public function updateItemQuantity(Request $request, $projectId, $itemId)
    {
        $projectItem = ProjectWarehouseItem::where('project_proposal_id', $projectId)
            ->where('id', $itemId)
            ->first();

        if (!$projectItem) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف غير موجود في السلة'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'quantity_per_unit' => 'required|numeric|min:0.01',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $project = $projectItem->projectProposal;
        
        // ✅ التحقق من حالة المشروع
        // ✅ منسق الكفالات يمكنه تحديث الكميات لمشاريع الكفالات حتى "منتهي"
        $user = $request->user();
        $isOrphanSponsorCoordinator = $user->role === 'orphan_sponsor_coordinator';
        $isSponsorshipProject = $project->isSponsorshipProject();
        
        if (!$isOrphanSponsorCoordinator || !$isSponsorshipProject) {
            // ✅ للآخرين: منع إذا كان المشروع "منتهي" أو "ملغى"
            if (in_array($project->status, ['منتهي', 'ملغى'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تحديث الكميات - المشروع ' . $project->status
                ], 422);
            }
        } else {
            // ✅ منسق الكفالات: منع فقط "ملغى"
            if ($project->status === 'ملغى') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تحديث الكميات - المشروع ملغى'
                ], 422);
            }
        }
        
        $warehouseItem = $projectItem->warehouseItem;
        $isConfirmed = $projectItem->status === 'confirmed';

        // ✅ إذا كان الصنف مؤكداً، نحتاج لإرجاع الكمية القديمة وإضافة الكمية الجديدة
        if ($isConfirmed) {
            DB::beginTransaction();
            try {
                // إرجاع الكمية القديمة للمخزن
                $oldTotalNeeded = $projectItem->quantity_per_unit * $project->quantity;
                $warehouseItem->addQuantity($oldTotalNeeded, $request->user()->id);

                // التحقق من توفر الكمية الجديدة
                $newTotalNeeded = $request->quantity_per_unit * $project->quantity;
                if (!$warehouseItem->hasEnoughStock($newTotalNeeded)) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'error' => 'الكمية غير كافية',
                        'message' => 'الكمية المتوفرة: ' . $warehouseItem->quantity_available . ' فقط',
                        'available_quantity' => $warehouseItem->quantity_available,
                        'required_quantity' => $newTotalNeeded
                    ], 422);
                }

                // خصم الكمية الجديدة من المخزن
                $warehouseItem->subtractQuantity($newTotalNeeded, $request->user()->id);

                // تحديث الكمية
                $projectItem->update([
                    'quantity_per_unit' => $request->quantity_per_unit,
                ]);

                // ✅ إعادة حساب الوافر/العجز
                $project->recordSurplus($request->user()->id, 'تم تحديث كمية الصنف بعد تأكيد التوريد');

                DB::commit();

                // ✅ مسح cache للمشاريع والمخازن بعد تحديث الكمية
                $this->clearProjectsCache();

                return response()->json([
                    'success' => true,
                    'message' => 'تم تحديث الكمية بنجاح (تم إرجاع الكمية القديمة وإضافة الكمية الجديدة)',
                    'data' => $projectItem->fresh(['warehouseItem'])
                ], 200);
            } catch (\Exception $e) {
                DB::rollBack();
                \Log::error('Error updating confirmed item quantity', [
                    'project_id' => $projectId,
                    'item_id' => $itemId,
                    'error' => $e->getMessage()
                ]);
                
                return response()->json([
                    'success' => false,
                    'message' => 'حدث خطأ أثناء تحديث الكمية',
                    'error' => config('app.debug') ? $e->getMessage() : 'يرجى المحاولة مرة أخرى'
                ], 500);
            }
        }

        // ✅ للأصناف المعلقة (pending) - السلوك العادي
        // التحقق من توفر الكمية
        if ($project->quantity && $project->quantity > 0) {
            $totalNeeded = $request->quantity_per_unit * $project->quantity;
            if (!$warehouseItem->hasEnoughStock($totalNeeded)) {
                return response()->json([
                    'success' => false,
                    'error' => 'الكمية غير كافية',
                    'message' => 'الكمية المتوفرة: ' . $warehouseItem->quantity_available . ' فقط',
                    'available_quantity' => $warehouseItem->quantity_available,
                    'required_quantity' => $totalNeeded
                ], 422);
            }
        }

        $projectItem->update([
            'quantity_per_unit' => $request->quantity_per_unit,
        ]);

        // ✅ مسح cache للمشاريع والمخازن بعد تحديث الكمية
        $this->clearProjectsCache();

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الكمية بنجاح',
            'data' => $projectItem->fresh(['warehouseItem'])
        ], 200);
    }

    /**
     * تحديث عدد الطرود للمشروع
     * PATCH /api/projects/{projectId}/warehouse/quantity
     */
    public function updateProjectQuantity(Request $request, $projectId)
    {
        $project = ProjectProposal::find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }

        // ✅ التحقق من حالة المشروع
        // ✅ منسق الكفالات يمكنه تحديث عدد الطرود لمشاريع الكفالات حتى "منتهي"
        $user = $request->user();
        $isOrphanSponsorCoordinator = $user->role === 'orphan_sponsor_coordinator';
        $isSponsorshipProject = $project->isSponsorshipProject();
        
        if (!$isOrphanSponsorCoordinator || !$isSponsorshipProject) {
            // ✅ للآخرين: منع إذا كان المشروع "منتهي" أو "ملغى"
            if (in_array($project->status, ['منتهي', 'ملغى'])) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تحديث عدد الطرود - المشروع ' . $project->status
                ], 422);
            }
        } else {
            // ✅ منسق الكفالات: منع فقط "ملغى"
            if ($project->status === 'ملغى') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تحديث عدد الطرود - المشروع ملغى'
                ], 422);
            }
        }

        $validator = Validator::make($request->all(), [
            'quantity' => 'required|integer|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $newQuantity = $request->quantity;

        // التحقق من توفر الكميات لجميع الأصناف في السلة
        $items = $project->pendingWarehouseItems()->with('warehouseItem')->get();
        foreach ($items as $item) {
            $totalNeeded = $item->quantity_per_unit * $newQuantity;
            if (!$item->warehouseItem->hasEnoughStock($totalNeeded)) {
                return response()->json([
                    'success' => false,
                    'error' => 'الكمية غير كافية',
                    'message' => "الكمية غير كافية للصنف: {$item->warehouseItem->item_name}. المتوفر: {$item->warehouseItem->quantity_available}",
                    'item_name' => $item->warehouseItem->item_name,
                    'available_quantity' => $item->warehouseItem->quantity_available,
                    'required_quantity' => $totalNeeded
                ], 422);
            }
        }

        $project->update(['quantity' => $newQuantity]);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث عدد الطرود بنجاح',
            'data' => $project
        ], 200);
    }

    /**
     * تأكيد التوريد وخصم الكميات من المخزن
     * POST /api/projects/{projectId}/warehouse/confirm
     */
    public function confirmProjectSupply(Request $request, $projectId)
    {
        // ✅ تحميل جميع الأصناف (pending و confirmed) للسماح بالتأكيد مرة أخرى
        $project = ProjectProposal::with([
            'pendingWarehouseItems.warehouseItem',
            'confirmedWarehouseItems.warehouseItem'
        ])->find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }

        // ✅ السماح بتأكيد التوريد في جميع حالات المشروع
        // يمكن تأكيد التوريد من أي حالة (جديد، قيد التوريد، تم التوريد، إلخ)
        // ✅ منسق الكفالات يمكنه التوريد حتى "منتهي" لمشاريع الكفالات
        // منع فقط الحالات النهائية (منتهي، ملغى) للآخرين
        $user = $request->user();
        $isOrphanSponsorCoordinator = $user->role === 'orphan_sponsor_coordinator';
        $isSponsorshipProject = $project->isSponsorshipProject();
        
        // ✅ منسق الكفالات يمكنه التوريد لمشاريع الكفالات حتى "منتهي"
        if (!$isOrphanSponsorCoordinator || !$isSponsorshipProject) {
            $nonChangeableStatuses = ['منتهي', 'ملغى'];
            if (in_array($project->status, $nonChangeableStatuses)) {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تأكيد التوريد للمشاريع المنتهية أو الملغاة'
                ], 422);
            }
        } else {
            // ✅ منسق الكفالات: منع فقط "ملغى"
            if ($project->status === 'ملغى') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تأكيد التوريد للمشاريع الملغاة'
                ], 422);
            }
        }

        // ✅ التحقق من وجود أصناف (pending أو confirmed)
        // السماح بالتأكيد مرة أخرى حتى لو كانت الأصناف مؤكدة بالفعل
        $hasPendingItems = !$project->pendingWarehouseItems->isEmpty();
        $hasConfirmedItems = !$project->confirmedWarehouseItems->isEmpty();
        
        if (!$hasPendingItems && !$hasConfirmedItems) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد أصناف في السلة'
            ], 422);
        }
        
        // ✅ إذا كانت الأصناف مؤكدة بالفعل، نستخدمها بدلاً من pending
        // هذا يسمح بإعادة التأكيد لإعادة الحساب أو التحديث
        $itemsToProcess = $hasPendingItems 
            ? $project->pendingWarehouseItems 
            : $project->confirmedWarehouseItems;

        // التحقق من تحديد عدد الطرود
        if (!$project->quantity || $project->quantity <= 0) {
            return response()->json([
                'success' => false,
                'message' => 'يجب تحديد عدد الطرود أولاً'
            ], 422);
        }

        // Validate surplus category - required for supply confirmation
        $validator = Validator::make($request->all(), [
            'surplus_category_id' => 'required|exists:surplus_categories,id',
            'notes' => 'nullable|string',
        ], [
            'surplus_category_id.required' => 'يجب اختيار صندوق الفائض قبل تأكيد التوريد',
            'surplus_category_id.exists' => 'صندوق الفائض المحدد غير موجود',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            // ✅ تسجيل معلومات المشروع للتشخيص
            Log::info('Starting project supply confirmation', [
                'project_id' => $projectId,
                'project_type' => $project->project_type,
                'is_sponsorship' => $project->isSponsorshipProject(),
                'quantity' => $project->quantity,
                'pending_items_count' => $project->pendingWarehouseItems->count(),
                'confirmed_items_count' => $project->confirmedWarehouseItems->count(),
                'user_id' => $request->user()->id,
                'user_role' => $request->user()->role,
            ]);

            // ✅ التحقق النهائي من توفر الكميات وخصمها
            // إذا كانت الأصناف مؤكدة بالفعل، نعيد الكمية القديمة أولاً
            foreach ($itemsToProcess as $item) {
                $totalNeeded = $item->quantity_per_unit * $project->quantity;
                
                // ✅ إذا كان الصنف مؤكداً بالفعل، نعيد الكمية القديمة للمخزن أولاً
                if ($item->status === 'confirmed') {
                    $oldTotalNeeded = $item->quantity_per_unit * $project->quantity;
                    $item->warehouseItem->addQuantity($oldTotalNeeded, $request->user()->id);
                }
                
                // التحقق من توفر الكمية الجديدة
                if (!$item->warehouseItem->hasEnoughStock($totalNeeded)) {
                    DB::rollBack();
                    return response()->json([
                        'success' => false,
                        'error' => 'الكمية غير كافية',
                        'message' => "الكمية غير كافية للصنف: {$item->warehouseItem->item_name}",
                        'item_name' => $item->warehouseItem->item_name,
                        'available_quantity' => $item->warehouseItem->quantity_available,
                        'required_quantity' => $totalNeeded
                    ], 422);
                }

                // خصم الكمية من المخزن
                $item->warehouseItem->subtractQuantity($totalNeeded, $request->user()->id);

                // تحديث حالة الصنف إلى مؤكد
                $item->update(['status' => 'confirmed']);
            }

            // تحديث قسم الوافر إذا تم تحديده
            if ($request->has('surplus_category_id') && $request->surplus_category_id) {
                try {
                    $project->update(['surplus_category_id' => $request->surplus_category_id]);
                    Log::info('Updated surplus_category_id', [
                        'project_id' => $projectId,
                        'surplus_category_id' => $request->surplus_category_id,
                    ]);
                } catch (\Exception $e) {
                    // إذا كان العمود غير موجود في قاعدة البيانات، نتجاهل الخطأ
                    Log::warning('Failed to update surplus_category_id (column may not exist)', [
                        'project_id' => $projectId,
                        'surplus_category_id' => $request->surplus_category_id,
                        'error' => $e->getMessage()
                    ]);
                }
            }

            // ✅ تسجيل الوافر/العجز مع معالجة الأخطاء
            try {
                Log::info('Recording surplus before calculation', [
                    'project_id' => $projectId,
                    'quantity' => $project->quantity,
                    'net_amount' => $project->net_amount,
                    'net_amount_shekel' => $project->net_amount_shekel,
                    'has_shekel_conversion' => $project->hasShekelConversion(),
                ]);
                
                $project->recordSurplus($request->user()->id, $request->notes);
                
                Log::info('Surplus recorded successfully', [
                    'project_id' => $projectId,
                    'unit_cost' => $project->unit_cost,
                    'supply_cost' => $project->supply_cost,
                    'surplus_amount' => $project->surplus_amount,
                    'has_deficit' => $project->has_deficit,
                ]);
            } catch (\Exception $e) {
                Log::error('Error in recordSurplus', [
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
                throw $e; // إعادة رمي الخطأ للتعامل معه في catch الخارجي
            }

            // تغيير حالة المشروع
            $oldStatus = $project->status;
            $project->update(['status' => 'تم التوريد']);

            // ✅ تسجيل في Timeline مع معالجة الأخطاء
            try {
                $project->recordStatusChange(
                    $oldStatus,
                    'تم التوريد',
                    $request->user()->id,
                    'تم تأكيد التوريد من المخزن'
                );
                Log::info('Status change recorded in timeline', [
                    'project_id' => $projectId,
                    'old_status' => $oldStatus,
                    'new_status' => 'تم التوريد',
                ]);
            } catch (\Exception $e) {
                Log::warning('Failed to record status change in timeline', [
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                ]);
                // لا نوقف العملية إذا فشل تسجيل Timeline
            }

            // ✅ إرسال إشعار لمدير المخزن مع معالجة الأخطاء
            try {
                NotificationHelper::createSupplyConfirmedNotification($project);
                Log::info('Supply confirmed notification sent', [
                    'project_id' => $projectId,
                ]);
            } catch (\Exception $e) {
                Log::warning('Failed to send supply confirmed notification', [
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                ]);
                // لا نوقف العملية إذا فشل إرسال الإشعار
            }

            // ✅ إرسال إشعار إذا كان هناك عجز مع معالجة الأخطاء
            try {
                if ($project->has_deficit) {
                    NotificationHelper::createDeficitNotification($project, $project->surplus_amount);
                    Log::info('Deficit notification sent', [
                        'project_id' => $projectId,
                        'deficit_amount' => $project->surplus_amount,
                    ]);
                }
            } catch (\Exception $e) {
                Log::warning('Failed to send deficit notification', [
                    'project_id' => $projectId,
                    'error' => $e->getMessage(),
                ]);
                // لا نوقف العملية إذا فشل إرسال الإشعار
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم تأكيد التوريد بنجاح',
                'data' => [
                    'project' => $project->fresh(), // TODO: إضافة 'surplusCategory' بعد رفع migrations
                    'has_deficit' => $project->has_deficit,
                    'surplus_amount' => $project->surplus_amount,
                ]
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            
            // ✅ تسجيل الخطأ للـ debugging مع معلومات مفصلة
            Log::error('Error confirming project supply', [
                'project_id' => $projectId,
                'user_id' => $request->user()->id ?? null,
                'user_role' => $request->user()->role ?? null,
                'project_type' => $project->project_type ?? null,
                'is_sponsorship' => isset($project) && method_exists($project, 'isSponsorshipProject') ? $project->isSponsorshipProject() : null,
                'quantity' => $project->quantity ?? null,
                'surplus_category_id' => $request->input('surplus_category_id'),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تأكيد التوريد',
                'error' => config('app.debug') ? $e->getMessage() : 'يرجى المحاولة مرة أخرى',
                'debug_info' => config('app.debug') ? [
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                ] : null
            ], 500);
        }
    }

    /**
     * إلغاء التوريد وحذف السلة
     * POST /api/projects/{projectId}/warehouse/cancel
     */
    public function cancelProjectSupply($projectId)
    {
        $project = ProjectProposal::find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }

        // حذف جميع الأصناف المعلقة
        $deletedCount = $project->pendingWarehouseItems()->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم إلغاء التوريد وحذف السلة',
            'deleted_items' => $deletedCount
        ], 200);
    }

    /**
     * تعديل التوريد المؤكد
     * POST /api/projects/{projectId}/warehouse/edit
     * 
     * يسمح بتعديل الأصناف والكميات بعد تأكيد التوريد
     * يمكن إضافة أصناف جديدة، حذف أصناف موجودة، أو تعديل كميات الأصناف
     */
    public function editConfirmedSupply(Request $request, $projectId)
    {
        $project = ProjectProposal::with(['confirmedWarehouseItems.warehouseItem'])->find($projectId);

        if (!$project) {
            return response()->json([
                'success' => false,
                'message' => 'المشروع غير موجود'
            ], 404);
        }

        // ✅ السماح بتعديل التوريد في جميع الحالات ما عدا "منتهي"
        // ✅ منسق الكفالات يمكنه تعديل التوريد لمشاريع الكفالات حتى "منتهي"
        // ✅ الأدمن يمكنه تعديل التوريد في جميع الحالات
        $user = $request->user();
        $isAdmin = $user && strtolower($user->role ?? '') === 'admin';
        $isOrphanSponsorCoordinator = $user->role === 'orphan_sponsor_coordinator';
        $isSponsorshipProject = $project->isSponsorshipProject();
        
        // ✅ الأدمن يمكنه التعديل في جميع الحالات
        if ($isAdmin) {
            // الأدمن يمكنه تعديل التوريد حتى لو كان المشروع منتهي أو ملغى
            // لا حاجة لفحص الحالة
        } elseif ($isOrphanSponsorCoordinator && $isSponsorshipProject) {
            // ✅ منسق الكفالات: منع فقط "ملغى"
            if ($project->status === 'ملغى') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تعديل التوريد - المشروع ملغى',
                    'current_status' => $project->status,
                ], 422);
            }
        } else {
            // ✅ المستخدمون الآخرون: منع "منتهي" و "ملغى"
            if ($project->status === 'منتهي') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تعديل التوريد - المشروع منتهي',
                    'current_status' => $project->status,
                ], 422);
            }
            if ($project->status === 'ملغى') {
                return response()->json([
                    'success' => false,
                    'message' => 'لا يمكن تعديل التوريد - المشروع ملغى',
                    'current_status' => $project->status,
                ], 422);
            }
        }

        // ✅ السماح بتعديل التوريد حتى لو لم تكن هناك أصناف مؤكدة مسبقاً
        // (يمكن إضافة أصناف جديدة)
        // التحقق من وجود أصناف مؤكدة أو أصناف جديدة في الطلب
        $hasConfirmedItems = !$project->confirmedWarehouseItems->isEmpty();
        $hasNewItems = $request->has('items') && !empty($request->items);
        
        if (!$hasConfirmedItems && !$hasNewItems) {
            return response()->json([
                'success' => false,
                'message' => 'يجب إضافة أصناف على الأقل'
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'items' => 'required|array|min:1',
            'items.*.id' => 'nullable|exists:project_warehouse_items,id', // nullable للأصناف الجديدة
            'items.*.warehouse_item_id' => 'nullable|exists:warehouse_items,id', // للأصناف الجديدة
            'items.*.quantity_per_unit' => 'required|numeric|min:0.01',
            'items_to_delete' => 'nullable|array', // IDs الأصناف المراد حذفها
            'items_to_delete.*' => 'exists:project_warehouse_items,id',
            'quantity' => 'nullable|integer|min:1',
            'surplus_category_id' => 'nullable|exists:surplus_categories,id', // ✅ إضافة: تغيير صندوق الفائض
            'beneficiaries_count' => 'nullable|integer|min:0', // ✅ إضافة: تغيير عدد المستفيدين (يدوي)
            'beneficiaries_per_unit' => 'nullable|integer|min:0', // ✅ إضافة: تغيير عدد المستفيدين لكل طرد
            'notes' => 'nullable|string',
        ], [
            'surplus_category_id.exists' => 'صندوق الفائض المحدد غير موجود',
            'beneficiaries_count.integer' => 'عدد المستفيدين يجب أن يكون رقماً صحيحاً',
            'beneficiaries_count.min' => 'عدد المستفيدين لا يمكن أن يكون سالباً',
            'beneficiaries_per_unit.integer' => 'عدد المستفيدين لكل طرد يجب أن يكون رقماً صحيحاً',
            'beneficiaries_per_unit.min' => 'عدد المستفيدين لكل طرد لا يمكن أن يكون سالباً',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        DB::beginTransaction();
        try {
            $oldQuantity = $project->quantity;
            $newQuantity = $request->input('quantity', $oldQuantity);

            // 1. إرجاع الكميات القديمة للمخزن (لجميع الأصناف المؤكدة)
            // ✅ فقط إذا كانت هناك أصناف مؤكدة مسبقاً
            if ($hasConfirmedItems) {
                foreach ($project->confirmedWarehouseItems as $oldItem) {
                    $oldTotalNeeded = $oldItem->quantity_per_unit * $oldQuantity;
                    $oldItem->warehouseItem->addQuantity($oldTotalNeeded, $request->user()->id);
                }
            }

            // 2. حذف الأصناف المحددة للحذف
            if ($request->has('items_to_delete') && !empty($request->items_to_delete)) {
                $itemsToDelete = $project->confirmedWarehouseItems()
                    ->whereIn('id', $request->items_to_delete)
                    ->get();
                
                foreach ($itemsToDelete as $itemToDelete) {
                    $itemToDelete->delete();
                }
            }

            // 3. تحديث الأصناف الموجودة وإضافة الأصناف الجديدة
            $existingItemIds = [];
            $addedItemsCount = 0;
            $updatedItemsCount = 0;
            
            Log::info('Starting to process items for edit', [
                'project_id' => $projectId,
                'items_count' => count($request->items),
                'user_id' => $request->user()->id,
            ]);
            
            foreach ($request->items as $itemData) {
                if (isset($itemData['id']) && $itemData['id']) {
                    // تحديث صنف موجود
                    $projectItem = $project->confirmedWarehouseItems()
                        ->where('id', $itemData['id'])
                        ->first();

                    if (!$projectItem) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => "الصنف رقم {$itemData['id']} غير موجود في التوريد"
                        ], 404);
                    }

                    $newQuantityPerUnit = $itemData['quantity_per_unit'];
                    $newTotalNeeded = $newQuantityPerUnit * $newQuantity;

                    // التحقق من توفر الكمية الجديدة
                    if (!$projectItem->warehouseItem->hasEnoughStock($newTotalNeeded)) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'error' => 'الكمية غير كافية',
                            'message' => "الكمية غير كافية للصنف: {$projectItem->warehouseItem->item_name}",
                            'item_name' => $projectItem->warehouseItem->item_name,
                            'available_quantity' => $projectItem->warehouseItem->quantity_available,
                            'required_quantity' => $newTotalNeeded
                        ], 422);
                    }

                    // خصم الكمية الجديدة من المخزن
                    $projectItem->warehouseItem->subtractQuantity($newTotalNeeded, $request->user()->id);

                    // تحديث الكمية في التوريد
                    $projectItem->update([
                        'quantity_per_unit' => $newQuantityPerUnit
                    ]);

                    $existingItemIds[] = $itemData['id'];
                    $updatedItemsCount++;
                    
                    Log::info('Updated existing item', [
                        'item_id' => $itemData['id'],
                        'new_quantity_per_unit' => $newQuantityPerUnit,
                    ]);
                } else {
                    // إضافة صنف جديد
                    if (!isset($itemData['warehouse_item_id'])) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => 'يجب تحديد warehouse_item_id للأصناف الجديدة'
                        ], 422);
                    }

                    $warehouseItem = WarehouseItem::find($itemData['warehouse_item_id']);
                    if (!$warehouseItem) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => "الصنف رقم {$itemData['warehouse_item_id']} غير موجود في المخزن"
                        ], 404);
                    }

                    if (!$warehouseItem->is_active) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => "الصنف {$warehouseItem->item_name} غير نشط"
                        ], 422);
                    }

                    // ✅ التحقق من عدم وجود الصنف مسبقاً في التوريد (confirmed أو pending)
                    $existingItem = ProjectWarehouseItem::where('project_proposal_id', $projectId)
                        ->where('warehouse_item_id', $itemData['warehouse_item_id'])
                        ->whereIn('status', ['confirmed', 'pending'])
                        ->first();

                    if ($existingItem) {
                        // ✅ إذا كان الصنف موجود بحالة pending، نحوله إلى confirmed ونحدث الكمية
                        if ($existingItem->status === 'pending') {
                            $newQuantityPerUnit = $itemData['quantity_per_unit'];
                            $newTotalNeeded = $newQuantityPerUnit * $newQuantity;
                            
                            // إرجاع الكمية القديمة للمخزن
                            $oldTotalNeeded = $existingItem->quantity_per_unit * ($project->quantity ?? 1);
                            $warehouseItem->addQuantity($oldTotalNeeded, $request->user()->id);
                            
                            // التحقق من توفر الكمية الجديدة
                            if (!$warehouseItem->hasEnoughStock($newTotalNeeded)) {
                                DB::rollBack();
                                return response()->json([
                                    'success' => false,
                                    'error' => 'الكمية غير كافية',
                                    'message' => "الكمية غير كافية للصنف: {$warehouseItem->item_name}",
                                    'item_name' => $warehouseItem->item_name,
                                    'available_quantity' => $warehouseItem->quantity_available,
                                    'required_quantity' => $newTotalNeeded
                                ], 422);
                            }
                            
                            // خصم الكمية الجديدة من المخزن
                            $warehouseItem->subtractQuantity($newTotalNeeded, $request->user()->id);
                            
                            // تحديث الصنف الموجود
                            $existingItem->update([
                                'quantity_per_unit' => $newQuantityPerUnit,
                                'status' => 'confirmed',
                                'unit_price' => $warehouseItem->unit_price,
                                'total_price_per_unit' => round($newQuantityPerUnit * $warehouseItem->unit_price, 2),
                            ]);
                            
                            $existingItemIds[] = $existingItem->id;
                            $updatedItemsCount++;
                            
                            Log::info('Converted pending item to confirmed', [
                                'item_id' => $existingItem->id,
                                'warehouse_item_id' => $itemData['warehouse_item_id'],
                                'new_quantity_per_unit' => $newQuantityPerUnit,
                            ]);
                            
                            continue;
                        } else {
                            // الصنف موجود بحالة confirmed
                            DB::rollBack();
                            return response()->json([
                                'success' => false,
                                'message' => "الصنف {$warehouseItem->item_name} موجود مسبقاً في التوريد"
                            ], 422);
                        }
                    }

                    $newQuantityPerUnit = $itemData['quantity_per_unit'];
                    $newTotalNeeded = $newQuantityPerUnit * $newQuantity;

                    // التحقق من توفر الكمية
                    if (!$warehouseItem->hasEnoughStock($newTotalNeeded)) {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'error' => 'الكمية غير كافية',
                            'message' => "الكمية غير كافية للصنف: {$warehouseItem->item_name}",
                            'item_name' => $warehouseItem->item_name,
                            'available_quantity' => $warehouseItem->quantity_available,
                            'required_quantity' => $newTotalNeeded
                        ], 422);
                    }

                    // خصم الكمية من المخزن
                    $warehouseItem->subtractQuantity($newTotalNeeded, $request->user()->id);

                    // ✅ إضافة الصنف الجديد للتوريد
                    $newItem = ProjectWarehouseItem::create([
                        'project_proposal_id' => $projectId,
                        'warehouse_item_id' => $itemData['warehouse_item_id'],
                        'quantity_per_unit' => $newQuantityPerUnit,
                        'unit_price' => $warehouseItem->unit_price,
                        'total_price_per_unit' => round($newQuantityPerUnit * $warehouseItem->unit_price, 2),
                        'status' => 'confirmed',
                    ]);
                    
                    $existingItemIds[] = $newItem->id;
                    $addedItemsCount++;
                    
                    Log::info('Added new item to project', [
                        'new_item_id' => $newItem->id,
                        'warehouse_item_id' => $itemData['warehouse_item_id'],
                        'quantity_per_unit' => $newQuantityPerUnit,
                    ]);
                }
            }

            // ✅ 4. حذف الأصناف التي لم يتم تحديثها (إذا لم يتم إرسالها في items)
            // ✅ إعادة تحميل المشروع بعد إضافة/تحديث الأصناف
            $project->refresh();
            $project->load('confirmedWarehouseItems');

            // ✅ IDs الأصناف التي يجب الاحتفاظ بها (تم تحديثها أو إضافتها في هذه العملية)
            $keptItemIds = array_filter($existingItemIds);

            // ✅ IDs الأصناف المطلوب حذفها صراحة من الطلب
            $itemsToDeleteFromRequest = $request->items_to_delete ?? [];

            $itemsToRemove = $project->confirmedWarehouseItems()
                ->whereNotIn('id', $keptItemIds)
                ->whereNotIn('id', $itemsToDeleteFromRequest)
                ->get();

            $deletedItemsCount = 0;
            foreach ($itemsToRemove as $itemToRemove) {
                // إرجاع الكمية للمخزن (تم إرجاعها مسبقاً، لكن نتأكد)
                $itemToRemove->delete();
                $deletedItemsCount++;
                
                Log::info('Deleted item not in request', [
                    'item_id' => $itemToRemove->id,
                ]);
            }
            
            Log::info('Items processing completed', [
                'project_id' => $projectId,
                'added_count' => $addedItemsCount,
                'updated_count' => $updatedItemsCount,
                'deleted_count' => $deletedItemsCount,
            ]);

            // 5. تحديث عدد الطرود إذا تغير
            $updateData = [];
            if ($newQuantity != $oldQuantity) {
                $updateData['quantity'] = $newQuantity;
            }

            // ✅ تحديث صندوق الفائض إذا تم تحديده
            if ($request->has('surplus_category_id')) {
                $updateData['surplus_category_id'] = $request->surplus_category_id;
            }

            // ✅ تحديث عدد المستفيدين إذا تم تحديده
            if ($request->has('beneficiaries_count')) {
                $updateData['beneficiaries_count'] = $request->beneficiaries_count;
            }
            if ($request->has('beneficiaries_per_unit')) {
                $updateData['beneficiaries_per_unit'] = $request->beneficiaries_per_unit;
            }

            // تحديث المشروع إذا كان هناك بيانات للتحديث
            if (!empty($updateData)) {
                $project->update($updateData);
            }

            // 6. إعادة حساب الوافر/العجز
            $project->recordSurplus($request->user()->id, $request->notes);

            // 7. تسجيل في Timeline
            $project->recordStatusChange(
                'تم التوريد',
                'تم التوريد',
                $request->user()->id,
                'تم تعديل التوريد المؤكد'
            );

            DB::commit();

            // ✅ إعادة تحميل المشروع مع الأصناف المحدثة
            $project->refresh();
            $project->load(['confirmedWarehouseItems.warehouseItem', 'surplusCategory']);

            return response()->json([
                'success' => true,
                'message' => 'تم تعديل التوريد بنجاح',
                'data' => [
                    'project' => $project->fresh(['confirmedWarehouseItems.warehouseItem', 'surplusCategory']),
                    'has_deficit' => $project->has_deficit,
                    'surplus_amount' => $project->surplus_amount,
                    'unit_cost' => $project->unit_cost,
                    'supply_cost' => $project->supply_cost,
                    'items_summary' => [
                        'items_added' => $addedItemsCount,
                        'items_updated' => $updatedItemsCount,
                        'items_deleted' => $deletedItemsCount,
                        'total_items' => $project->confirmedWarehouseItems->count(),
                    ]
                ]
            ], 200);
        } catch (\Exception $e) {
            DB::rollBack();
            
            \Log::error('Error editing confirmed supply', [
                'project_id' => $projectId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء تعديل التوريد',
                'error' => config('app.debug') ? $e->getMessage() : 'يرجى المحاولة مرة أخرى'
            ], 500);
        }
    }

    /**
     * مسح cache للفائض
     */
    private function clearSurplusCache(): void
    {
        try {
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['surplus_dashboard', 'surplus_statistics', 'surplus_categories'])->flush();
            } else {
                Cache::flush();
            }
        } catch (\Exception $e) {
            \Log::warning('Failed to clear surplus cache', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * مسح cache للمشاريع والمخازن
     */
    private function clearProjectsCache(): void
    {
        try {
            // ✅ استخدام Cache tags إذا كان متاحاً (Redis/Memcached)
            if (method_exists(Cache::getStore(), 'tags')) {
                Cache::tags(['projects', 'warehouse'])->flush();
            } else {
                // ✅ في حالة عدم دعم tags، نمسح cache keys المتعلقة
                $cacheDriver = Cache::getStore();
                if (method_exists($cacheDriver, 'getRedis')) {
                    // Redis - مسح keys محددة
                    $redis = $cacheDriver->getRedis();
                    $patterns = ['*projects_*', '*warehouse*'];
                    foreach ($patterns as $pattern) {
                        $keys = $redis->keys($pattern);
                        if (!empty($keys)) {
                            $redis->del($keys);
                        }
                    }
                } else {
                    // Fallback: مسح جميع cache
                    Cache::flush();
                }
            }
        } catch (\Exception $e) {
            // ✅ في حالة فشل مسح cache، نستمر بدون خطأ
            Log::warning('Failed to clear projects cache from ProjectWarehouseController', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
