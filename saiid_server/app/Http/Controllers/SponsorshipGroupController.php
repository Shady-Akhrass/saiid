<?php

namespace App\Http\Controllers;

use App\Models\SponsorshipGroup;
use App\Models\SponsorshipItem;
use App\Models\Currency;
use App\Models\ProjectProposal;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class SponsorshipGroupController extends Controller
{
    // =============================================
    // GROUP CRUD
    // =============================================

    /**
     * List all groups with totals
     */
    public function index()
    {
        $groups = SponsorshipGroup::withCount('items')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $groups,
        ]);
    }

    /**
     * Show single group with items
     */
    public function show($id)
    {
        $group = SponsorshipGroup::with(['items.currency'])->findOrFail($id);

        return response()->json([
            'success' => true,
            'data' => $group,
        ]);
    }

    /**
     * Create a new group
     */
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'notes' => 'nullable|string',
        ]);

        $code = SponsorshipGroup::generateCode($request->name);

        $group = SponsorshipGroup::create([
            'name' => $request->name,
            'code' => $code,
            'notes' => $request->notes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم إنشاء المجموعة بنجاح',
            'data' => $group,
        ], 201);
    }

    /**
     * Update a group
     */
    public function update(Request $request, $id)
    {
        $group = SponsorshipGroup::findOrFail($id);

        $request->validate([
            'name' => 'required|string|max:255',
            'notes' => 'nullable|string',
        ]);

        // If name changed, regenerate code
        if ($request->name !== $group->name) {
            $group->code = SponsorshipGroup::generateCode($request->name);
        }

        $group->update([
            'name' => $request->name,
            'code' => $group->code,
            'notes' => $request->notes,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث المجموعة بنجاح',
            'data' => $group,
        ]);
    }

    /**
     * Delete a group (cascades to items)
     */
    public function destroy($id)
    {
        $group = SponsorshipGroup::findOrFail($id);
        $group->delete();

        return response()->json([
            'success' => true,
            'message' => 'تم حذف المجموعة بنجاح',
        ]);
    }

    // =============================================
    // ITEM CRUD
    // =============================================

    /**
     * List items for a group
     */
    public function items($groupId)
    {
        $group = SponsorshipGroup::findOrFail($groupId);
        $items = $group->items()->with('currency')->orderBy('created_at', 'desc')->get();

        return response()->json([
            'success' => true,
            'data' => $items,
            'group' => $group,
        ]);
    }

    /**
     * Create a new item in a group
     */
    public function storeItem(Request $request, $groupId)
    {
        $group = SponsorshipGroup::findOrFail($groupId);

        $request->validate([
            'name' => 'required|string|max:255',
            'donor_code' => 'nullable|string|max:255',
            'orphans_count' => 'required|integer|min:0',
            'cost' => 'required|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'currency_id' => 'required|exists:currencies,id',
            'notes' => 'nullable|string',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,jpg,png,gif,webp|max:5120',
        ]);

        // Calculate USD amount
        $currency = Currency::findOrFail($request->currency_id);
        $amountInUsd = $request->cost * ($currency->exchange_rate_to_usd ?? 1);

        // Handle image uploads
        $imagePaths = [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $path = $image->store('sponsorship_items', 'public');
                $imagePaths[] = $path;
            }
        }

        $item = SponsorshipItem::create([
            'sponsorship_group_id' => $group->id,
            'name' => $request->name,
            'donor_code' => $request->donor_code,
            'orphans_count' => $request->orphans_count,
            'cost' => $request->cost,
            'discount_percentage' => $request->discount_percentage ?? 0,
            'currency_id' => $request->currency_id,
            'amount_in_usd' => $amountInUsd,
            'images' => !empty($imagePaths) ? $imagePaths : null,
            'notes' => $request->notes,
        ]);

        $item->load('currency');

        return response()->json([
            'success' => true,
            'message' => 'تم إضافة الكفالة بنجاح',
            'data' => $item,
            'group' => $group->fresh(),
        ], 201);
    }

    /**
     * Update an item
     */
    public function updateItem(Request $request, $groupId, $itemId)
    {
        $item = SponsorshipItem::where('sponsorship_group_id', $groupId)->findOrFail($itemId);

        $request->validate([
            'name' => 'required|string|max:255',
            'donor_code' => 'nullable|string|max:255',
            'orphans_count' => 'required|integer|min:0',
            'cost' => 'required|numeric|min:0',
            'discount_percentage' => 'nullable|numeric|min:0|max:100',
            'currency_id' => 'required|exists:currencies,id',
            'notes' => 'nullable|string',
            'images' => 'nullable|array',
            'images.*' => 'image|mimes:jpeg,jpg,png,gif,webp|max:5120',
        ]);

        // Calculate USD amount
        $currency = Currency::findOrFail($request->currency_id);
        $amountInUsd = $request->cost * ($currency->exchange_rate_to_usd ?? 1);

        // Handle image uploads (append to existing)
        $imagePaths = $item->images ?? [];
        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $image) {
                $path = $image->store('sponsorship_items', 'public');
                $imagePaths[] = $path;
            }
        }

        $item->update([
            'name' => $request->name,
            'donor_code' => $request->donor_code,
            'orphans_count' => $request->orphans_count,
            'cost' => $request->cost,
            'discount_percentage' => $request->discount_percentage ?? 0,
            'currency_id' => $request->currency_id,
            'amount_in_usd' => $amountInUsd,
            'images' => !empty($imagePaths) ? $imagePaths : null,
            'notes' => $request->notes,
        ]);

        $item->load('currency');

        return response()->json([
            'success' => true,
            'message' => 'تم تحديث الكفالة بنجاح',
            'data' => $item,
            'group' => $item->group->fresh(),
        ]);
    }

    /**
     * Delete an item
     */
    public function deleteItem($groupId, $itemId)
    {
        $item = SponsorshipItem::where('sponsorship_group_id', $groupId)->findOrFail($itemId);

        // Delete stored images
        if (!empty($item->images)) {
            foreach ($item->images as $path) {
                Storage::disk('public')->delete($path);
            }
        }

        $item->delete();

        $group = SponsorshipGroup::findOrFail($groupId);

        return response()->json([
            'success' => true,
            'message' => 'تم حذف الكفالة بنجاح',
            'group' => $group,
        ]);
    }

    /**
     * Remove a specific image from an item
     */
    public function removeImage(Request $request, $groupId, $itemId)
    {
        $item = SponsorshipItem::where('sponsorship_group_id', $groupId)->findOrFail($itemId);

        $request->validate([
            'image_index' => 'required|integer|min:0',
        ]);

        $images = $item->images ?? [];
        $index = $request->image_index;

        if (isset($images[$index])) {
            Storage::disk('public')->delete($images[$index]);
            array_splice($images, $index, 1);
            $item->update(['images' => !empty($images) ? $images : null]);
        }

        return response()->json([
            'success' => true,
            'data' => $item->fresh(),
        ]);
    }

    // =============================================
    // CREATE AS PROJECT
    // =============================================

    /**
     * Create project proposals from all items in a group
     * Accepts: exchange_rate, estimated_duration_days, project_type_id from frontend modal
     */
    public function createAsProject(Request $request, $id)
    {
        $request->validate([
            'exchange_rate' => 'nullable|numeric|min:0',
            'estimated_duration_days' => 'nullable|integer|min:1',
            'project_type_id' => 'nullable|integer|exists:project_types,id',
            'subcategory_id' => 'nullable|integer|exists:project_subcategories,id',
            'sponsorship_item_ids' => 'nullable|array',
            'sponsorship_item_ids.*' => 'integer|exists:sponsorship_items,id',
        ]);

        $group = SponsorshipGroup::with(['items.currency'])->findOrFail($id);

        $itemsToProcess = collect($group->items);
        if ($request->filled('sponsorship_item_ids') && count($request->sponsorship_item_ids) > 0) {
            $requestedIds = array_map('intval', $request->sponsorship_item_ids);
            $itemsToProcess = $itemsToProcess->filter(function($item) use ($requestedIds) {
                return in_array($item->id, $requestedIds);
            });
        }

        if ($itemsToProcess->isEmpty()) {
            return response()->json([
                'success' => false,
                'message' => 'لا توجد كفالات مطابقة لإنشاء المشروع',
            ], 422);
        }

        $createdProjects = [];

        // Project type: from request or lookup
        $projectTypeId = $request->project_type_id;
        if (!$projectTypeId) {
            $projectType = DB::table('project_types')->where('name', 'الكفالات')->first();
            if (!$projectType) {
                $projectType = DB::table('project_types')->first();
            }
            $projectTypeId = $projectType ? $projectType->id : 1;
        }

        $exchangeRate = $request->exchange_rate ?? 1.0;
        $estimatedDuration = $request->estimated_duration_days;

        DB::beginTransaction();
        try {
            foreach ($itemsToProcess as $item) {
                $discountPct = $item->discount_percentage ?? 0;
                $discountAmount = $item->cost * ($discountPct / 100);
                $netAmount = $item->cost - $discountAmount;

                // Determine the first image path for the legacy notes_image column
                $firstNoteImagePath = null;
                if (!empty($item->images) && count($item->images) > 0) {
                    $firstNoteImagePath = 'project_notes_images/' . basename($item->images[0]);
                }

                // ✅ Auto-generate Code: S-[First 2 letters]-[Sequence]
                $namePrefix = mb_substr(trim($item->name), 0, 2, 'UTF-8');
                // Replace spaces if the first two chars have them, optional.
                $namePrefix = str_replace(' ', '', $namePrefix);
                // Ensure we have at least 2 chars if possible, otherwise pad it
                $namePrefix = mb_str_pad($namePrefix, 2, 'X', STR_PAD_RIGHT, 'UTF-8');
                
                $codePrefix = 'S-' . $namePrefix;
                
                // Find existing projects for this item to determine sequence
                $lastProject = ProjectProposal::where('project_name', $item->name)
                    ->where('donor_code', 'LIKE', $codePrefix . '-%')
                    ->orderBy('id', 'desc')
                    ->first();
                
                $sequence = 1;
                if ($lastProject && preg_match('/-(\d+)$/', $lastProject->donor_code, $matches)) {
                    $sequence = intval($matches[1]) + 1;
                }
                
                $generatedCode = $codePrefix . '-' . str_pad($sequence, 4, '0', STR_PAD_LEFT);

                $project = ProjectProposal::create([
                    'project_name' => $item->name,
                    'donor_code' => $generatedCode,
                    'donor_name' => $group->name,
                    'project_type_id' => $projectTypeId,
                    'subcategory_id' => $request->subcategory_id,
                    'donation_amount' => $item->cost,
                    'currency_id' => $item->currency_id,
                    'exchange_rate' => $exchangeRate,
                    'amount_in_usd' => $item->amount_in_usd,
                    'admin_discount_percentage' => $discountPct,
                    'discount_amount' => $discountAmount,
                    'net_amount' => $netAmount,
                    'beneficiaries_count' => $item->orphans_count,
                    'estimated_duration_days' => $estimatedDuration,
                    'notes' => $item->notes,
                    'notes_image' => $firstNoteImagePath, // Set the primary note image
                    'status' => 'جديد',
                    'created_by' => auth()->id(),
                ]);

                // Copy images correctly as "note" type to the PUBLIC directory
                if (!empty($item->images)) {
                    $targetDir = public_path('project_notes_images');
                    if (!file_exists($targetDir)) {
                        @mkdir($targetDir, 0755, true);
                    }

                    foreach ($item->images as $index => $sourcePath) {
                        try {
                            $filename = basename($sourcePath);
                            $targetPath = 'project_notes_images/' . $filename;
                            
                            $fullSourcePath = Storage::disk('public')->path($sourcePath);
                            $fullTargetPath = $targetDir . DIRECTORY_SEPARATOR . $filename;
                            
                            // Use PHP copy to copy from storage to public root
                            if (file_exists($fullSourcePath)) {
                                if (@copy($fullSourcePath, $fullTargetPath)) {
                                    if (Schema::hasTable('project_proposal_images')) {
                                        DB::table('project_proposal_images')->insert([
                                            'project_proposal_id' => $project->id,
                                            'image_path' => $targetPath,
                                            'type' => 'note',
                                            'display_order' => $index,
                                            'created_at' => now(),
                                            'updated_at' => now(),
                                        ]);
                                    }
                                }
                            }
                        } catch (\Exception $e) {
                            Log::warning("Failed to copy image for sponsorship item {$item->id}: " . $e->getMessage());
                        }
                    }
                }

                $createdProjects[] = $project;
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء ' . count($createdProjects) . ' مشروع بنجاح من مجموعة الكفالات',
                'data' => $createdProjects,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Error creating projects from sponsorship group {$id}: " . $e->getMessage());

            return response()->json([
                'success' => false,
                'message' => 'حدث خطأ أثناء إنشاء المشاريع: ' . $e->getMessage(),
            ], 500);
        }
    }
}

