import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
  Plus, Edit, Trash2, FolderOpen, ChevronRight, Search,
  Users, DollarSign, Hash, Rocket, X, Save, Loader2,
  RotateCcw, BarChart3, TrendingUp, Clock, ChevronDown
} from 'lucide-react';

const SponsorshipGroups = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // ✅ Role Check: Only Admin can access this page
  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';

  const isAdmin = userRole === 'admin' ||
    userRole === 'administrator' ||
    userRole === 'مدير' ||
    userRole === 'مدير عام';

  useEffect(() => {
    // If user is loaded and not an admin, redirect
    if (user && !isAdmin) {
      toast.error('ليس لديك صلاحية للوصول لهذه الصفحة');
      navigate('/dashboard');
    }
  }, [user, isAdmin, navigate]);

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [formData, setFormData] = useState({ name: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  // Create as project modal state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalGroupId, setProjectModalGroupId] = useState(null);
  const [projectTypes, setProjectTypes] = useState([]);
  const [projectSubcategories, setProjectSubcategories] = useState([]);
  const [projectFormData, setProjectFormData] = useState({
    project_name: '',
    estimated_duration_days: '',
    project_type_id: '',
    subcategory_id: '',
    sponsorship_item_ids: [],
  });
  const [creatingProject, setCreatingProject] = useState(false);

  // Expanded group items
  const [expandedGroups, setExpandedGroups] = useState({});
  const [groupItems, setGroupItems] = useState({});
  const [loadingGroupItems, setLoadingGroupItems] = useState({});

  useEffect(() => { fetchGroups(); fetchProjectTypes(); }, []);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/sponsorship-groups');
      if (res.data.success) setGroups(res.data.data || []);
    } catch (err) {
      toast.error('فشل تحميل مجموعات الكفالات');
    } finally {
      setLoading(false);
    }
  };

  const fetchProjectTypes = async () => {
    try {
      const res = await apiClient.get('/project-types');
      if (res.data) {
        const types = res.data.data || res.data.project_types || res.data || [];
        setProjectTypes(Array.isArray(types) ? types : []);
      }
    } catch (err) {
      console.warn('Could not fetch project types');
    }
  };

  const fetchProjectSubcategories = async (typeId, autoSelect = false) => {
    try {
      const res = await apiClient.get(`/project-subcategories/by-type/${typeId}`);
      if (res.data) {
        const subs = res.data.data || res.data || [];
        setProjectSubcategories(subs);
        if (autoSelect && subs.length > 0) {
          // Auto-select orphan subcategory ('كفالة أيتام') if found, otherwise first one
          const orphanSub = subs.find(s =>
            s.name && (s.name.includes('أيتام') || s.name.includes('يتيم'))
          );
          const defaultSub = orphanSub || subs[0];
          setProjectFormData(prev => ({ ...prev, subcategory_id: String(defaultSub.id) }));
        }
      }
    } catch (err) {
      console.warn('Could not fetch subcategories', err);
    }
  };

  useEffect(() => {
    if (projectFormData.project_type_id) {
      fetchProjectSubcategories(projectFormData.project_type_id, true);
    } else {
      setProjectSubcategories([]);
      setProjectFormData(prev => ({ ...prev, subcategory_id: '' }));
    }
  }, [projectFormData.project_type_id]);

  const fetchGroupItems = async (groupId) => {
    if (groupItems[groupId] !== undefined) {
      setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
      return;
    }
    setLoadingGroupItems(prev => ({ ...prev, [groupId]: true }));
    setExpandedGroups(prev => ({ ...prev, [groupId]: true }));
    try {
      const res = await apiClient.get(`/sponsorship-groups/${groupId}/items`);
      if (res.data.success) {
        setGroupItems(prev => ({ ...prev, [groupId]: res.data.data || [] }));
      }
    } catch (err) {
      toast.error('فشل تحميل الكفالات');
      setGroupItems(prev => ({ ...prev, [groupId]: [] }));
    } finally {
      setLoadingGroupItems(prev => ({ ...prev, [groupId]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('اسم المجموعة مطلوب'); return; }
    setSubmitting(true);
    try {
      if (editingGroup) {
        await apiClient.put(`/sponsorship-groups/${editingGroup.id}`, formData);
        toast.success('تم تحديث المجموعة');
      } else {
        await apiClient.post('/sponsorship-groups', formData);
        toast.success('تم إنشاء المجموعة');
      }
      setShowModal(false);
      setEditingGroup(null);
      setFormData({ name: '', notes: '' });
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه المجموعة؟ سيتم حذف جميع الكفالات المرتبطة.')) return;
    try {
      await apiClient.delete(`/sponsorship-groups/${id}`);
      toast.success('تم حذف المجموعة');
      setExpandedGroups(prev => { const u = { ...prev }; delete u[id]; return u; });
      setGroupItems(prev => { const u = { ...prev }; delete u[id]; return u; });
      fetchGroups();
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل الحذف');
    }
  };

  const fetchItemsQuietly = async (groupId) => {
    if (groupItems[groupId] !== undefined) return;
    try {
      const res = await apiClient.get(`/sponsorship-groups/${groupId}/items`);
      if (res.data.success) {
        setGroupItems(prev => ({ ...prev, [groupId]: res.data.data || [] }));
      }
    } catch (err) { }
  };

  const openProjectModal = async (groupId) => {
    setProjectModalGroupId(groupId);
    const group = groups.find(g => g.id === groupId);
    const groupName = group ? group.name : '';
    setProjectFormData({ project_name: groupName, estimated_duration_days: '', project_type_id: '', subcategory_id: '', sponsorship_item_ids: [] });
    
    if (groupItems[groupId] === undefined) {
      fetchItemsQuietly(groupId);
    }

    try {
      const typesRes = await apiClient.get('/project-types');
      const types = typesRes.data?.data || typesRes.data?.project_types || typesRes.data || [];
      const sponsorshipType = types.find(t => t.name && t.name.includes('كفالات'));
      if (sponsorshipType) {
        setProjectFormData(prev => ({ ...prev, project_type_id: String(sponsorshipType.id) }));
      }
    } catch(err) {
      // ignore
    }

    setShowProjectModal(true);
  };


  const handleCreateAsProject = async (e) => {
    e.preventDefault();
    setCreatingProject(true);
    try {
      const payload = {
        project_name: projectFormData.project_name?.trim() || null,
        estimated_duration_days: projectFormData.estimated_duration_days ? parseInt(projectFormData.estimated_duration_days) : null,
        project_type_id: projectFormData.project_type_id ? parseInt(projectFormData.project_type_id) : null,
      };
      if (projectFormData.subcategory_id) {
        payload.subcategory_id = parseInt(projectFormData.subcategory_id);
      }
      if (projectFormData.sponsorship_item_ids && projectFormData.sponsorship_item_ids.length > 0) {
        payload.sponsorship_item_ids = projectFormData.sponsorship_item_ids.map(Number);
      }

      const res = await apiClient.post(`/sponsorship-groups/${projectModalGroupId}/create-as-project`, payload);
      if (res.data.success) {
        toast.success(res.data.message);
        setShowProjectModal(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'فشل إنشاء المشاريع');
    } finally {
      setCreatingProject(false);
    }
  };

  const openEdit = (group) => {
    setEditingGroup(group);
    setFormData({ name: group.name, notes: group.notes || '' });
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingGroup(null);
    setFormData({ name: '', notes: '' });
    setShowModal(true);
  };

  const filtered = groups.filter(g =>
    g.name.includes(searchQuery) || g.code?.includes(searchQuery)
  );

  if (loading) {
    return (
      <div style={{ fontFamily: 'Cairo, Tajawal, Arial, sans-serif' }} className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Cairo, Tajawal, Arial, sans-serif' }} className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 p-4" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">مجموعات الكفالات</h1>
              <p className="text-sky-100">إدارة مجموعات الكفالات وإنشاء مشاريع منها</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openCreate}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                مجموعة جديدة
              </button>
              <button
                onClick={() => { setGroupItems({}); setExpandedGroups({}); fetchGroups(); }}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                تحديث البيانات
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">إجمالي المجموعات</p>
                <p className="text-2xl font-bold text-gray-800">{groups.length}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">إجمالي الأيتام</p>
                <p className="text-2xl font-bold text-gray-800">{groups.reduce((s, g) => s + (g.total_orphans || 0), 0)}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">إجمالي الكفالات</p>
                <p className="text-2xl font-bold text-gray-800">{groups.reduce((s, g) => s + (g.items_count || 0), 0)}</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">التكلفة الكلية (USD)</p>
                <p className="text-2xl font-bold text-gray-800">${groups.reduce((s, g) => s + parseFloat(g.total_cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
          <div className="relative">
            <Search className="absolute right-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="البحث عن مجموعات بالاسم أو الكود..."
              className="w-full pr-10 pl-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Groups Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-20">
              <FolderOpen className="mx-auto text-gray-300 mb-4" size={60} />
              <p className="text-gray-500 text-lg">لا توجد مجموعات</p>
              <button onClick={openCreate} className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                إنشاء مجموعة جديدة
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">اسم المجموعة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الكود</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عدد الأيتام</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">عدد الكفالات</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التكلفة (USD)</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filtered.map((group) => {
                    const isExpanded = expandedGroups[group.id];
                    const items = groupItems[group.id] || [];
                    const isLoadingItems = loadingGroupItems[group.id];

                    return (
                      <React.Fragment key={group.id}>
                        <tr className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <button
                              onClick={() => fetchGroupItems(group.id)}
                              className="text-sm font-medium text-blue-600 hover:text-blue-800 flex items-center gap-2"
                            >
                              {isLoadingItems ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : isExpanded ? (
                                <ChevronDown className="w-4 h-4" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                              {group.name}
                              {isExpanded && items.length > 0 && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                                  {items.length}
                                </span>
                              )}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">{group.code}</span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-700">{group.total_orphans || 0}</td>
                          <td className="px-6 py-4 text-sm text-gray-700">{group.items_count || 0}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                            ${parseFloat(group.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => navigate(`/project-management/sponsorship-groups/${group.id}/items`)}
                                className="p-1.5 bg-sky-100 text-sky-700 rounded-lg hover:bg-sky-200 text-xs font-semibold flex items-center gap-1"
                                title="إدارة الكفالات"
                              >
                                <ChevronRight size={14} /> إدارة
                              </button>
                              <button onClick={() => openEdit(group)} className="p-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200" title="تعديل">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => handleDelete(group.id)} className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="حذف">
                                <Trash2 size={14} />
                              </button>
                              <button
                                onClick={() => openProjectModal(group.id)}
                                disabled={(group.items_count || 0) === 0}
                                className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 text-xs font-semibold"
                                title="إنشاء كمشاريع"
                              >
                                <Rocket size={14} /> مشاريع
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Expanded items */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="p-0">
                              <div className="bg-blue-50/50 p-4 border-t border-b border-blue-100">
                                {isLoadingItems ? (
                                  <div className="text-center py-4">
                                    <Loader2 className="animate-spin mx-auto text-blue-500" size={24} />
                                  </div>
                                ) : items.length === 0 ? (
                                  <p className="text-center text-gray-500 text-sm py-4">لا توجد كفالات</p>
                                ) : (
                                  <table className="w-full">
                                    <thead>
                                      <tr className="text-xs text-gray-500">
                                        <th className="text-right pb-2 pr-3">اسم الكفالة</th>
                                        <th className="text-right pb-2">كود المتبرع</th>
                                        <th className="text-right pb-2">الأيتام</th>
                                        <th className="text-right pb-2">التكلفة</th>
                                        <th className="text-right pb-2">الخصم %</th>
                                        <th className="text-right pb-2">بالدولار</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-blue-100">
                                      {items.map(item => (
                                        <tr key={item.id} className="text-sm">
                                          <td className="py-2 pr-3 font-medium text-gray-800">{item.name}</td>
                                          <td className="py-2 text-gray-600 font-mono text-xs">{item.donor_code || '-'}</td>
                                          <td className="py-2">
                                            <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{item.orphans_count}</span>
                                          </td>
                                          <td className="py-2 text-gray-700">
                                            {parseFloat(item.cost || 0).toLocaleString()} {item.currency?.currency_code || ''}
                                          </td>
                                          <td className="py-2 text-gray-600">{item.discount_percentage || 0}%</td>
                                          <td className="py-2 font-medium text-green-700">${parseFloat(item.amount_in_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Group Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">{editingGroup ? 'تعديل المجموعة' : 'مجموعة جديدة'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المجموعة *</label>
                <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: رمضان 2026" required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {!editingGroup && formData.name && (
                  <p className="text-xs text-gray-500 mt-1">الكود: <span className="font-mono text-blue-600">{formData.name}-O-XXXX</span></p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {editingGroup ? 'حفظ' : 'إنشاء'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create As Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowProjectModal(false)}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <Rocket className="text-green-600" size={22} />
                إنشاء كمشاريع
              </h2>
              <button onClick={() => setShowProjectModal(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">يرجى تعبئة البيانات المطلوبة لإنشاء مشاريع من كفالات هذه المجموعة</p>
            <form onSubmit={handleCreateAsProject} className="space-y-4">

              {/* Project Name (optional - applies to all created projects) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم المشروع (اختياري)</label>
                <input
                  type="text"
                  value={projectFormData.project_name}
                  onChange={(e) => setProjectFormData({ ...projectFormData, project_name: e.target.value })}
                  placeholder="يطبق على جميع الكفالات المختارة (اترك فارغاً لاستخدام اسم الكفالة)"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Estimated Duration */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Clock size={14} /> المدة التقديرية (بالأيام)
                </label>
                <input
                  type="number" min="1"
                  value={projectFormData.estimated_duration_days}
                  onChange={(e) => setProjectFormData({ ...projectFormData, estimated_duration_days: e.target.value })}
                  placeholder="مثال: 30"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Project Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">نوع المشروع</label>
                <select
                  value={projectFormData.project_type_id}
                  onChange={(e) => setProjectFormData({ ...projectFormData, project_type_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                >
                  <option value="">تلقائي (الكفالات)</option>
                  {projectTypes.map(pt => (
                    <option key={pt.id} value={pt.id}>{pt.name}</option>
                  ))}
                </select>
              </div>

              {/* Subcategory - always visible */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  التفريعة
                </label>
                <select
                  value={projectFormData.subcategory_id}
                  onChange={(e) => setProjectFormData({ ...projectFormData, subcategory_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white"
                >
                  <option value="">اختر التفريعة (اختياري)</option>
                  {projectSubcategories.map(cat => (
                    <option key={cat.id} value={String(cat.id)}>{cat.name_ar || cat.name}</option>
                  ))}
                </select>
                {projectSubcategories.length === 0 && projectFormData.project_type_id && (
                  <p className="text-xs text-amber-500 mt-1">جاري تحميل التفريعات...</p>
                )}
              </div>

              {/* Sponsorship Items - Multi Checkbox */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">اختيار الكفالات</label>
                  <div className="flex gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setProjectFormData(prev => ({ ...prev, sponsorship_item_ids: (groupItems[projectModalGroupId] || []).map(i => String(i.id)) }))}
                      className="text-blue-600 hover:underline"
                    >تحديد الكل</button>
                    <span className="text-gray-300">|</span>
                    <button
                      type="button"
                      onClick={() => setProjectFormData(prev => ({ ...prev, sponsorship_item_ids: [] }))}
                      className="text-red-500 hover:underline"
                    >إلغاء التحديد</button>
                  </div>
                </div>
                <div className="border border-gray-200 rounded-xl max-h-40 overflow-y-auto divide-y divide-gray-100">
                  {(groupItems[projectModalGroupId] || []).length === 0 ? (
                    <p className="text-center text-gray-400 text-sm py-4">جاري تحميل الكفالات...</p>
                  ) : (
                    (groupItems[projectModalGroupId] || []).map(item => {
                      const checked = projectFormData.sponsorship_item_ids.includes(String(item.id));
                      return (
                        <label
                          key={item.id}
                          className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                            checked ? 'bg-green-50' : 'hover:bg-gray-50'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const id = String(item.id);
                              setProjectFormData(prev => ({
                                ...prev,
                                sponsorship_item_ids: e.target.checked
                                  ? [...prev.sponsorship_item_ids, id]
                                  : prev.sponsorship_item_ids.filter(x => x !== id),
                              }));
                            }}
                            className="w-4 h-4 rounded text-green-600 border-gray-300 focus:ring-green-500"
                          />
                          <span className="text-sm text-gray-800 flex-1">{item.name}</span>
                          {item.donor_code && (
                            <span className="text-xs font-mono text-gray-400">{item.donor_code}</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {
                    projectFormData.sponsorship_item_ids.length === 0
                      ? 'إذا لم تختر أي كفالة، سيتم إنشاء مشروع لكل كفالات المجموعة'
                      : `سيتم إنشاء ${projectFormData.sponsorship_item_ids.length} مشروع`
                  }
                </p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
                سيتم إنشاء مشروع منفصل لكل كفالة في هذه المجموعة مع البيانات المالية الخاصة بها.
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={creatingProject}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                >
                  {creatingProject ? <Loader2 size={18} className="animate-spin" /> : <Rocket size={18} />}
                  إنشاء المشاريع
                </button>
                <button type="button" onClick={() => setShowProjectModal(false)} className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SponsorshipGroups;
