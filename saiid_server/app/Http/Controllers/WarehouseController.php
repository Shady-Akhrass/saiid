<?php

namespace App\Http\Controllers;

use App\Models\WarehouseItem;
use App\Models\User;
use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class WarehouseController extends Controller
{
    /**
     * عرض قائمة الأصناف في المخزن
     * GET /api/warehouse
     */
    public function index(Request $request)
    {
        $query = WarehouseItem::query()->with(['creator', 'updater']);

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->is_active);
        }

        // Filter by availability
        if ($request->has('available')) {
            if ($request->available == '1' || $request->available === 1) {
                $query->where('quantity_available', '>', 0);
            } else if ($request->available == '0' || $request->available === 0) {
                $query->where('quantity_available', '<=', 0);
            }
        }

        // Filter by low stock
        if ($request->has('low_stock') && $request->low_stock == 1) {
            $threshold = $request->input('threshold', 10);
            $query->lowStock($threshold);
        }

        // Search by item name
        if ($request->has('search')) {
            $query->where('item_name', 'like', '%' . $request->search . '%');
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->input('per_page', 15);
        $items = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $items
        ], 200);
    }

    /**
     * إضافة صنف جديد للمخزن
     * POST /api/warehouse
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'item_name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'quantity_available' => 'required|integer|min:0',
            'unit_price' => 'required|numeric|min:0',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        $item = WarehouseItem::create([
            'item_name' => $request->item_name,
            'description' => $request->description,
            'quantity_available' => $request->quantity_available,
            'unit_price' => $request->unit_price,
            'is_active' => $request->input('is_active', true),
            'created_by' => $request->user()->id,
            'updated_by' => $request->user()->id,
        ]);

        // ✅ مسح cache للمخازن والمشاريع بعد الإنشاء
        $this->clearWarehouseCache();

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة الصنف بنجاح',
            'data' => $item->load(['creator', 'updater'])
        ], 201);
    }

    /**
     * عرض تفاصيل صنف معين
     * GET /api/warehouse/{id}
     */
    public function show($id)
    {
        $item = WarehouseItem::with(['creator', 'updater'])->find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف غير موجود'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $item
        ], 200);
    }

    /**
     * تحديث صنف في المخزن
     * PATCH /api/warehouse/{id}
     */
    public function update(Request $request, $id)
    {
        $item = WarehouseItem::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف غير موجود'
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'item_name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string',
            'quantity_available' => 'sometimes|required|integer|min:0',
            'unit_price' => 'sometimes|required|numeric|min:0',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'errors' => $validator->errors()
            ], 422);
        }

        // بناء مصفوفة التحديث بناءً على الحقول المرسلة فقط
        $updateData = ['updated_by' => $request->user()->id];

        if ($request->has('item_name')) {
            $updateData['item_name'] = $request->item_name;
        }
        if ($request->has('description')) {
            $updateData['description'] = $request->description;
        }
        if ($request->has('quantity_available')) {
            $updateData['quantity_available'] = $request->quantity_available;
        }
        if ($request->has('unit_price')) {
            $updateData['unit_price'] = $request->unit_price;
        }
        if ($request->has('is_active')) {
            $updateData['is_active'] = $request->is_active;
        }

        $item->update($updateData);

        // ✅ مسح cache للمخازن والمشاريع بعد التحديث
        $this->clearWarehouseCache();

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الصنف بنجاح',
            'data' => $item->fresh(['creator', 'updater'])
        ], 200);
    }

    /**
     * حذف صنف من المخزن
     * DELETE /api/warehouse/{id}
     */
    public function destroy($id)
    {
        $item = WarehouseItem::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف غير موجود'
            ], 404);
        }

        // Check if item is used in any projects
        $usedInProjects = $item->projectWarehouseItems()->exists();
        if ($usedInProjects) {
            return response()->json([
                'success' => false,
                'message' => 'لا يمكن حذف الصنف لأنه مرتبط بمشاريع'
            ], 422);
        }

        $item->delete();

        // ✅ مسح cache للمخازن والمشاريع بعد الحذف
        $this->clearWarehouseCache();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الصنف بنجاح'
        ], 200);
    }

    /**
     * إضافة كمية لصنف في المخزن
     * POST /api/warehouse/{id}/add-quantity
     */
    public function addQuantity(Request $request, $id)
    {
        $item = WarehouseItem::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف غير موجود'
            ], 404);
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

        $item->addQuantity($request->quantity, $request->user()->id);

        // ✅ مسح cache للمخازن والمشاريع بعد إضافة الكمية
        $this->clearWarehouseCache();

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة الكمية بنجاح',
            'data' => $item->fresh(['creator', 'updater'])
        ], 200);
    }

    /**
     * خصم كمية من صنف في المخزن
     * POST /api/warehouse/{id}/subtract-quantity
     */
    public function subtractQuantity(Request $request, $id)
    {
        $item = WarehouseItem::find($id);

        if (!$item) {
            return response()->json([
                'success' => false,
                'message' => 'الصنف غير موجود'
            ], 404);
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

        try {
            $item->subtractQuantity($request->quantity, $request->user()->id);

            // ✅ مسح cache للمخازن والمشاريع بعد خصم الكمية
            $this->clearWarehouseCache();

            return response()->json([
                'success' => true,
                'message' => 'تم خصم الكمية بنجاح',
                'data' => $item->fresh(['creator', 'updater'])
            ], 200);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => $e->getMessage()
            ], 422);
        }
    }

    /**
     * Dashboard المخزن - إحصائيات
     * GET /api/warehouse/dashboard
     */
    public function dashboard()
    {
        $totalItems = WarehouseItem::active()->count();
        $totalValue = WarehouseItem::active()->get()->sum('total_value');
        $lowStockItems = WarehouseItem::active()->lowStock(10)->get();
        $outOfStockItems = WarehouseItem::active()->where('quantity_available', 0)->count();
        $availableItems = WarehouseItem::active()->available()->count();

        return response()->json([
            'success' => true,
            'data' => [
                'total_items' => $totalItems,
                'total_value' => round($totalValue, 2),
                'available_items' => $availableItems,
                'low_stock_count' => $lowStockItems->count(),
                'low_stock_items' => $lowStockItems,
                'out_of_stock_count' => $outOfStockItems,
            ]
        ], 200);
    }

    /**
     * جلب الأصناف المتوفرة للتسوق (لمدير المشاريع)
     * GET /api/warehouse/available
     */
    public function getAvailableItems(Request $request)
    {
        $query = WarehouseItem::active()->available()->with(['creator', 'updater']);

        // Search
        if ($request->has('search')) {
            $query->where('item_name', 'like', '%' . $request->search . '%');
        }

        // Sorting
        $sortBy = $request->input('sort_by', 'item_name');
        $sortOrder = $request->input('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->input('per_page', 50);
        $items = $query->paginate($perPage);

        return response()->json([
            'success' => true,
            'data' => $items
        ], 200);
    }

    /**
     * مسح cache للمخازن والمشاريع
     */
    private function clearWarehouseCache(): void
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
            Log::warning('Failed to clear warehouse cache', [
                'error' => $e->getMessage()
            ]);
        }
    }
}
