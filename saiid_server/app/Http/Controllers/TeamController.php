<?php

namespace App\Http\Controllers;

use App\Models\Team;
use App\Models\User;
use App\Models\TeamPersonnel;
use App\Traits\CacheableResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class TeamController extends Controller
{
    use CacheableResponse;

    /**
     * Get all teams
     * ✅ جلب البيانات مباشرة من قاعدة البيانات (بدون cache عند وجود _t)
     */
    public function index(Request $request)
    {
        try {
            // ✅ دعم cache busting parameter من Frontend
            $useCache = !$request->has('_t');
            
            if ($useCache) {
            $user = $request->user();
            $cacheKey = $this->buildCacheKey('teams', $request, $user?->id, $user?->role);
            
            return $this->getCachedResponse($cacheKey, function() use ($request) {
                    return $this->getTeamsData($request);
                }, 300);
            }
            
            // ✅ جلب مباشر من قاعدة البيانات (بدون cache)
            return response()->json($this->getTeamsData($request), 200)
                ->header('Cache-Control', 'no-cache, must-revalidate')
                ->header('Pragma', 'no-cache')
                ->header('Expires', '0');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الفرق',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * جلب بيانات الفرق من قاعدة البيانات
     */
    private function getTeamsData(Request $request): array
    {
                $query = Team::with(['leader', 'activeMembers' => function($query) {
                    $query->withPivot('role_in_team', 'is_active');
                }]);
                
                if ($request->has('active_only')) {
                    $query->active();
                }
                
                $teams = $query->orderBy('team_name')->get();
                
                // تنسيق البيانات
                $teams = $teams->map(function($team) {
                    $team->activeMembers = $team->activeMembers->map(function($member) {
                        return [
                            'id' => $member->id,
                            'name' => $member->name,
                            'phone_number' => $member->phone_number,
                            'personnel_type' => $member->personnel_type,
                            'department' => $member->department,
                            'role_in_team' => $member->pivot->role_in_team,
                            'is_active' => $member->pivot->is_active,
                        ];
                    });
                    return $team;
                });
                
                return [
                    'success' => true,
                    'teams' => $teams,
                    'count' => $teams->count()
                ];
    }

    /**
     * إبطال cache الفرق
     */
    private function clearTeamsCache(): void
    {
        try {
            $this->clearCacheByPrefix('teams');
        } catch (\Exception $e) {
            \Log::warning('فشل إبطال cache الفرق', [
                'error' => $e->getMessage()
            ]);
        }
    }

    /**
     * Create new team
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'team_name' => 'required|string|min:3|unique:teams,team_name',
            'team_leader_id' => 'nullable|exists:users,id',
            'team_type' => 'nullable|in:إغاثة,مشاريع تنموية,صحة,تعليم',
        ], [
            'team_name.required' => 'يرجى إدخال اسم الفريق',
            'team_name.min' => 'اسم الفريق يجب أن يكون 3 أحرف على الأقل',
            'team_name.unique' => 'اسم الفريق موجود مسبقاً',
            'team_leader_id.exists' => 'قائد الفريق المحدد غير موجود',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            DB::beginTransaction();

        try {
            $team = Team::create($request->all());
            $team->load(['leader', 'activeMembers']);
                
                // ✅ إبطال cache الفرق بعد الإنشاء
                $this->clearTeamsCache();
                
                DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'تم إنشاء الفريق بنجاح',
                    'team' => $team->fresh(['leader', 'activeMembers']) // ✅ إرجاع السجل الكامل المحدث
                ], 201)
                    ->header('Cache-Control', 'no-cache, must-revalidate')
                    ->header('Content-Type', 'application/json');
                
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إنشاء الفريق',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update team
     */
    public function update(Request $request, $id)
    {
        $validator = Validator::make($request->all(), [
            'team_name' => 'sometimes|string|min:3|unique:teams,team_name,' . $id,
            'team_leader_id' => 'nullable|exists:users,id',
            'team_type' => 'nullable|in:إغاثة,مشاريع تنموية,صحة,تعليم',
            'is_active' => 'sometimes|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            DB::beginTransaction();

        try {
            $team = Team::findOrFail($id);
            $team->update($request->all());
                
                // ✅ إعادة تحميل الفريق من قاعدة البيانات
                $team->refresh();
            $team->load(['leader', 'activeMembers']);
                
                // ✅ إبطال cache الفرق بعد التحديث
                $this->clearTeamsCache();
                
                DB::commit();
            
            return response()->json([
                'success' => true,
                'message' => 'تم تحديث الفريق بنجاح',
                    'team' => $team // ✅ إرجاع السجل الكامل المحدث
                ], 200)
                    ->header('Cache-Control', 'no-cache, must-revalidate')
                    ->header('Content-Type', 'application/json');
                
            } catch (\Exception $e) {
                DB::rollBack();
                throw $e;
            }
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل تحديث الفريق',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete team
     */
    public function destroy($id)
    {
        try {
            $team = Team::findOrFail($id);
            
            // Check if team has incomplete projects
            if ($team->hasIncompleteProjects()) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن حذف الفريق',
                    'message' => 'الفريق لديه مشاريع غير مكتملة'
                ], 422);
            }
            
            $team->delete();
            
            // ✅ إبطال cache الفرق بعد الحذف
            $this->clearTeamsCache();
            
            return response()->json([
                'success' => true,
                'message' => 'تم حذف الفريق بنجاح'
            ], 200)
                ->header('Cache-Control', 'no-cache, must-revalidate')
                ->header('Content-Type', 'application/json');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل حذف الفريق',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add member to team
     */
    public function addMember(Request $request, $teamId)
    {
        $validator = Validator::make($request->all(), [
            'personnel_id' => 'required|exists:team_personnel,id',
            'role_in_team' => 'required|in:قائد,عضو,منسق',
        ], [
            'personnel_id.required' => 'يرجى اختيار العامل',
            'personnel_id.exists' => 'العامل المحدد غير موجود',
            'role_in_team.required' => 'يرجى تحديد دور العضو',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $team = Team::findOrFail($teamId);
            $personnel = TeamPersonnel::findOrFail($request->personnel_id);
            
            // Check if personnel already in team
            if ($team->members()->where('personnel_id', $request->personnel_id)->exists()) {
                return response()->json([
                    'success' => false,
                    'error' => 'العامل موجود مسبقاً في الفريق'
                ], 422);
            }
            
            $team->members()->attach($request->personnel_id, [
                'role_in_team' => $request->role_in_team,
                'is_active' => true
            ]);
            
            // ✅ إعادة تحميل الفريق من قاعدة البيانات
            $team->refresh();
            $team->load(['leader', 'activeMembers']);
            
            // ✅ إبطال cache الفرق بعد إضافة العضو
            $this->clearTeamsCache();
            
            return response()->json([
                'success' => true,
                'message' => 'تم إضافة العضو للفريق بنجاح',
                'team' => $team
            ], 200)
                ->header('Cache-Control', 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة العضو',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Remove member from team
     */
    public function removeMember($teamId, $personnelId)
    {
        try {
            $team = Team::findOrFail($teamId);
            $personnel = TeamPersonnel::findOrFail($personnelId);

            if (!$team->members()->where('team_personnel.id', $personnelId)->exists()) {
                return response()->json([
                    'success' => false,
                    'error' => 'العضو غير موجود في هذا الفريق'
                ], 404);
            }

            // منع حذف آخر باحث أو مصور في الفريق
            if ($personnel->personnel_type === 'باحث' && $team->researchers()->count() <= 1) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إزالة الباحث الوحيد في الفريق',
                    'message' => 'يجب أن يحتوي الفريق على باحث واحد على الأقل'
                ], 422);
            }

            if ($personnel->personnel_type === 'مصور' && $team->photographers()->count() <= 1) {
                return response()->json([
                    'success' => false,
                    'error' => 'لا يمكن إزالة المصور الوحيد في الفريق',
                    'message' => 'يجب أن يحتوي الفريق على مصور واحد على الأقل'
                ], 422);
            }

            $team->members()->detach($personnelId);
            
            // ✅ إعادة تحميل الفريق من قاعدة البيانات
            $team->refresh();
            $team->load(['leader', 'activeMembers']);
            
            // ✅ إبطال cache الفرق بعد إزالة العضو
            $this->clearTeamsCache();
            
            return response()->json([
                'success' => true,
                'message' => 'تم إزالة العضو من الفريق بنجاح',
                'team' => $team
            ], 200)
                ->header('Cache-Control', 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إزالة العضو',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get photographers list (for project assignment)
     */
    public function photographers()
    {
        try {
            $photographers = TeamPersonnel::photographers()
                                          ->active()
                                          ->orderBy('name')
                                          ->get();
            
            return response()->json([
                'success' => true,
                'photographers' => $photographers,
                'count' => $photographers->count()
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب المصورين',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get team members by type (باحثين أو مصورين)
     */
    public function getTeamMembersByType(Request $request, $teamId)
    {
        $validator = Validator::make($request->all(), [
            'member_type' => 'required|in:باحث,مصور',
        ], [
            'member_type.required' => 'يرجى تحديد نوع العضو',
            'member_type.in' => 'نوع العضو يجب أن يكون: باحث أو مصور',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $team = Team::findOrFail($teamId);
            
            if ($request->member_type === 'باحث') {
                $members = $team->researchers()->get();
            } else {
                $members = $team->photographers()->get();
            }
            
            $members = $members->map(function($member) {
                return [
                    'id' => $member->id,
                    'name' => $member->name,
                    'phone_number' => $member->phone_number,
                    'personnel_type' => $member->personnel_type,
                    'department' => $member->department,
                    'role_in_team' => $member->pivot->role_in_team,
                ];
            });
            
            return response()->json([
                'success' => true,
                'team_id' => $team->id,
                'team_name' => $team->team_name,
                'member_type' => $request->member_type,
                'members' => $members,
                'count' => $members->count()
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب أعضاء الفريق',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add multiple members to team at once
     */
    public function addMultipleMembers(Request $request, $teamId)
    {
        $validator = Validator::make($request->all(), [
            'members' => 'required|array|min:1',
            'members.*.personnel_id' => 'required|exists:team_personnel,id',
            'members.*.role_in_team' => 'required|in:قائد,عضو,منسق',
        ], [
            'members.required' => 'يرجى إدخال قائمة الأعضاء',
            'members.array' => 'قائمة الأعضاء يجب أن تكون مصفوفة',
            'members.min' => 'يجب إضافة عضو واحد على الأقل',
            'members.*.personnel_id.required' => 'يرجى اختيار العامل',
            'members.*.personnel_id.exists' => 'العامل المحدد غير موجود',
            'members.*.role_in_team.required' => 'يرجى تحديد دور العضو',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 400);
        }

        try {
            $team = Team::findOrFail($teamId);
            $added = [];
            $skipped = [];
            
            foreach ($request->members as $memberData) {
                $personnel = TeamPersonnel::findOrFail($memberData['personnel_id']);
                
                // التحقق من عدم وجود العامل في الفريق
                if ($team->members()->where('personnel_id', $personnel->id)->exists()) {
                    $skipped[] = [
                        'personnel_id' => $personnel->id,
                        'name' => $personnel->name,
                        'reason' => 'العامل موجود مسبقاً في الفريق'
                    ];
                    continue;
                }
                
                // إضافة العضو
                $team->members()->attach($personnel->id, [
                    'role_in_team' => $memberData['role_in_team'],
                    'is_active' => true
                ]);
                
                $added[] = [
                    'personnel_id' => $personnel->id,
                    'name' => $personnel->name,
                    'personnel_type' => $personnel->personnel_type
                ];
            }
            
            // ✅ إعادة تحميل الفريق من قاعدة البيانات
            $team->refresh();
            $team->load(['leader', 'activeMembers']);
            
            // ✅ إبطال cache الفرق بعد إضافة الأعضاء
            $this->clearTeamsCache();
            
            return response()->json([
                'success' => true,
                'message' => 'تم إضافة الأعضاء للفريق',
                'added_count' => count($added),
                'skipped_count' => count($skipped),
                'added' => $added,
                'skipped' => $skipped,
                'team' => $team
            ], 200)
                ->header('Cache-Control', 'no-cache, must-revalidate');
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل إضافة الأعضاء',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all researchers and photographers for team creation
     */
    public function getAvailableMembers(Request $request)
    {
        try {
            $researchers = TeamPersonnel::researchers()
                                        ->active()
                                        ->orderBy('name')
                                        ->get();
            
            $photographers = TeamPersonnel::photographers()
                                          ->active()
                                          ->orderBy('name')
                                          ->get();
            
            return response()->json([
                'success' => true,
                'researchers' => $researchers,
                'photographers' => $photographers,
                'researchers_count' => $researchers->count(),
                'photographers_count' => $photographers->count()
            ], 200);
            
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => 'فشل جلب الأعضاء المتاحين',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}

