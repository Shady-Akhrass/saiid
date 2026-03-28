import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import apiClient, { getImageBaseUrl } from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import {
  Plus, Edit, Trash2, ArrowLeft, Save, X, Loader2,
  Users, DollarSign, Image as ImageIcon, Hash, FileText,
  RotateCcw, BarChart3, Percent
} from 'lucide-react';

const SponsorshipItems = () => {
  const { id: groupId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [group, setGroup] = useState(null);
  const [items, setItems] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  
  // Get base URL for images
  const imageBaseUrl = getImageBaseUrl();

  const emptyForm = {
    name: '',
    donor_code: '',
    orphans_count: '',
    cost: '',
    discount_percentage: '0',
    currency_id: '',
    notes: '',
  };
  const [formData, setFormData] = useState(emptyForm);
  const [donorCodeManual, setDonorCodeManual] = useState(false);

  const generateDonorCode = (name, existingItems, currentItemId = null) => {
    // Get first two letters from project name (group name)
    let projectPrefix = '';
    if (group && group.name && group.name.trim()) {
      projectPrefix = group.name.trim().slice(0, 2).toLowerCase();
    }
    
    // Format: s-{project_first_two}-{sequence}
    const prefix = projectPrefix ? 's-' + projectPrefix : 's';
    
    // Count existing items with same prefix (excluding current if editing)
    const existing = (existingItems || []).filter(it => {
      if (currentItemId && it.id === currentItemId) return false;
      return (it.donor_code || '').toLowerCase().startsWith(prefix + '-');
    });
    const seq = existing.length + 1;
    return prefix + '-' + String(seq).padStart(4, '0');
  };

  useEffect(() => {
    fetchItems();
    fetchCurrencies();
  }, [groupId]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get(`/sponsorship-groups/${groupId}/items`);
      if (res.data.success) {
        setItems(res.data.data || []);
        setGroup(res.data.group || null);
      }
    } catch (err) {
      toast.error('فشل تحميل الكفالات');
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrencies = async () => {
    try {
      const res = await apiClient.get('/currencies', {
        params: { per_page: 1000, include_inactive: false, _t: Date.now() },
        timeout: 20000,
      });
      if (res.data.success) {
        const data = res.data.currencies || res.data.data || [];
        setCurrencies(data.filter(c => c.is_active));
      }
    } catch (err) {
      setCurrencies([
        { id: 1, currency_name: 'دولار أمريكي', currency_code: 'USD', symbol: '$', exchange_rate_to_usd: 1.00, is_active: true },
        { id: 2, currency_name: 'يورو', currency_code: 'EUR', symbol: '€', exchange_rate_to_usd: 1.08, is_active: true },
      ]);
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.type.startsWith('image/') && f.size <= 5 * 1024 * 1024);
    if (valid.length !== files.length) toast.warning('بعض الملفات تم تجاهلها (غير صورة أو أكبر من 5MB)');

    setSelectedImages(prev => [...prev, ...valid]);
    const newPreviews = valid.map(f => URL.createObjectURL(f));
    setImagePreviews(prev => [...prev, ...newPreviews]);
  };

  const removeSpecificImage = (indexToRemove) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== indexToRemove));
    setImagePreviews(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  const getAmountInUsd = () => {
    const cost = parseFloat(formData.cost) || 0;
    const curr = currencies.find(c => c.id === parseInt(formData.currency_id));
    if (!curr) return 0;
    return cost * (curr.exchange_rate_to_usd || 1);
  };

  const getNetAfterDiscount = () => {
    const cost = parseFloat(formData.cost) || 0;
    const disc = parseFloat(formData.discount_percentage) || 0;
    return cost - (cost * disc / 100);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error('اسم الكفالة مطلوب'); return; }
    if (!formData.orphans_count || parseInt(formData.orphans_count) < 0) { toast.error('عدد الأيتام مطلوب'); return; }
    if (!formData.cost || parseFloat(formData.cost) <= 0) { toast.error('التكلفة مطلوبة'); return; }
    if (!formData.currency_id) { toast.error('العملة مطلوبة'); return; }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('name', formData.name.trim());
      if (formData.donor_code) fd.append('donor_code', formData.donor_code.trim());
      fd.append('orphans_count', parseInt(formData.orphans_count));
      fd.append('cost', parseFloat(formData.cost));
      fd.append('discount_percentage', parseFloat(formData.discount_percentage || 0));
      fd.append('currency_id', parseInt(formData.currency_id));
      if (formData.notes) fd.append('notes', formData.notes.trim());
      selectedImages.forEach(img => fd.append('images[]', img, img.name));

      if (editingItem) {
        fd.append('_method', 'PUT');
        await apiClient.post(`/sponsorship-groups/${groupId}/items/${editingItem.id}`, fd);
        toast.success('تم تحديث الكفالة');
      } else {
        await apiClient.post(`/sponsorship-groups/${groupId}/items`, fd);
        toast.success('تم إضافة الكفالة');
      }
      closeModal();
      fetchItems();
    } catch (err) {
      toast.error(err.response?.data?.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (itemId) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الكفالة؟')) return;
    try {
      await apiClient.delete(`/sponsorship-groups/${groupId}/items/${itemId}`);
      toast.success('تم حذف الكفالة');
      fetchItems();
    } catch (err) {
      toast.error('فشل الحذف');
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setDonorCodeManual(true); // editing: keep existing code
    setFormData({
      name: item.name || '',
      donor_code: item.donor_code || '',
      orphans_count: item.orphans_count || '',
      cost: item.cost || '',
      discount_percentage: item.discount_percentage || '0',
      currency_id: item.currency_id || '',
      notes: item.notes || '',
    });
    setSelectedImages([]);
    setImagePreviews([]);
    setShowModal(true);
  };

  const openCreate = () => {
    setEditingItem(null);
    setDonorCodeManual(false);
    setFormData(emptyForm);
    setSelectedImages([]);
    setImagePreviews([]);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData(emptyForm);
    setSelectedImages([]);
    setImagePreviews([]);
  };

  const getCurrencyLabel = (currencyId) => {
    const c = currencies.find(cur => cur.id === currencyId);
    return c ? `${c.symbol} ${c.currency_code}` : '';
  };

  if (loading) {
    return (
      <div style={{ fontFamily: 'Cairo, Tajawal, Arial, sans-serif' }} className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل الكفالات...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Cairo, Tajawal, Arial, sans-serif' }} className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 p-4" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/project-management/sponsorship-groups')}
                className="p-2 bg-white/20 rounded-xl hover:bg-white/30 transition-all"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-3xl font-bold mb-1">{group ? group.name : 'كفالات المجموعة'}</h1>
                {group && (
                  <p className="text-emerald-100 flex items-center gap-3 text-sm">
                    <span className="font-mono bg-white/20 px-2 py-0.5 rounded">{group.code}</span>
                    <span>•</span>
                    <span>{group.total_orphans || 0} يتيم</span>
                    <span>•</span>
                    <span>${parseFloat(group.total_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openCreate}
                className="bg-green-500 hover:bg-green-400 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                كفيل جديد
              </button>
              <button
                onClick={fetchItems}
                className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                تحديث
              </button>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">عدد الكفالات</p>
                <p className="text-2xl font-bold text-gray-800">{items.length}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <FileText className="w-4 h-4 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">إجمالي الأيتام</p>
                <p className="text-2xl font-bold text-gray-800">{items.reduce((s, i) => s + (i.orphans_count || 0), 0)}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Users className="w-4 h-4 text-green-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">إجمالي التكلفة</p>
                <p className="text-2xl font-bold text-gray-800">{items.reduce((s, i) => s + parseFloat(i.cost || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-purple-600" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">التكلفة (USD)</p>
                <p className="text-2xl font-bold text-gray-800">${items.reduce((s, i) => s + parseFloat(i.amount_in_usd || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          {items.length === 0 ? (
            <div className="text-center py-20">
              <FileText className="mx-auto text-gray-300 mb-4" size={60} />
              <p className="text-gray-500 text-lg">لا توجد كفالات في هذه المجموعة</p>
              <button onClick={openCreate} className="mt-4 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">إضافة كفيل</button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الاسم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">كود المتبرع</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الأيتام</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">التكلفة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">نسبة الخصم</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">بالدولار</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">صور</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{item.donor_code || '-'}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-medium">{item.orphans_count}</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-800">
                        {parseFloat(item.cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} {getCurrencyLabel(item.currency_id)}
                      </td>
                      <td className="px-6 py-4">
                        {parseFloat(item.discount_percentage || 0) > 0 ? (
                          <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded-full text-xs font-medium">{item.discount_percentage}%</span>
                        ) : (
                          <span className="text-gray-400 text-xs">0%</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-green-700">
                        ${parseFloat(item.amount_in_usd || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4">
                        {item.images && item.images.length > 0 ? (
                          <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 w-fit">
                            <ImageIcon size={12} />{item.images.length}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => openEdit(item)} className="p-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200" title="تعديل">
                            <Edit size={14} />
                          </button>
                          <button onClick={() => handleDelete(item.id)} className="p-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200" title="حذف">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-800">{editingItem ? 'تعديل الكفالة' : 'كفالة جديدة'}</h2>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg"><X size={20} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">اسم الكفيل / المشروع *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => {
                    const newName = e.target.value;
                    setFormData(prev => ({
                      ...prev,
                      name: newName,
                      donor_code: donorCodeManual
                        ? prev.donor_code
                        : generateDonorCode(newName, items, editingItem?.id),
                    }));
                  }}
                  placeholder="اسم الكفالة" required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Donor Code - auto-generated */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">كود المتبرع (تلقائي)</label>
                  <button
                    type="button"
                    onClick={() => {
                      setDonorCodeManual(!donorCodeManual);
                      if (donorCodeManual === false) {
                        // switching to manual - keep current value
                      } else {
                        // switching back to auto - regenerate
                        setFormData(prev => ({
                          ...prev,
                          donor_code: generateDonorCode(prev.name, items, editingItem?.id)
                        }));
                      }
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 underline"
                  >
                    {donorCodeManual ? 'إعادة التوليد التلقائي' : 'تعديل يدوي'}
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.donor_code}
                  onChange={(e) => {
                    if (donorCodeManual) setFormData({ ...formData, donor_code: e.target.value });
                  }}
                  readOnly={!donorCodeManual}
                  placeholder={formData.name ? generateDonorCode(formData.name, items, editingItem?.id) : 'سيتم توليده تلقائياً بعد كتابة الاسم'}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent font-mono text-sm ${donorCodeManual
                      ? 'border-blue-300 bg-white'
                      : 'border-gray-200 bg-gray-50 text-gray-500 cursor-default'
                    }`}
                />
                {!donorCodeManual && (
                  <p className="text-xs text-gray-400 mt-1">يتم توليد الكود تلقائياً من اسم الكفالة</p>
                )}
              </div>

              {/* Orphans Count */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">عدد الأيتام *</label>
                <input type="number" min="0" value={formData.orphans_count} onChange={(e) => setFormData({ ...formData, orphans_count: e.target.value })}
                  placeholder="0" required
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Cost + Currency */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">المبلغ قبل الخصم *</label>
                  <input type="number" min="0" step="0.01" value={formData.cost} onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    placeholder="0.00" required
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">العملة *</label>
                  <select value={formData.currency_id} onChange={(e) => setFormData({ ...formData, currency_id: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white" required
                  >
                    <option value="">اختر العملة</option>
                    {currencies.map(c => (
                      <option key={c.id} value={c.id}>{c.symbol} {c.currency_name} ({c.currency_code})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Discount Percentage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                  <Percent size={14} /> نسبة الخصم (%)
                </label>
                <input type="number" min="0" max="100" step="0.01"
                  value={formData.discount_percentage}
                  onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                  placeholder="0"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Previews */}
              {formData.cost && formData.currency_id && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-green-700">المبلغ بالدولار:</span>
                    <span className="font-bold text-green-800">${getAmountInUsd().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                  {parseFloat(formData.discount_percentage) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-700">بعد الخصم ({formData.discount_percentage}%):</span>
                      <span className="font-bold text-green-800">{getNetAfterDiscount().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">صور (اختياري)</label>
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="file"
                      id="sponsorship_images_input"
                      multiple
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="sponsorship_images_input"
                      className="flex flex-col items-center justify-center w-full px-4 py-6 bg-white border-2 border-dashed border-gray-300 rounded-xl transition-all duration-300 cursor-pointer hover:border-green-400 hover:bg-green-50"
                    >
                      <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                      <span className="text-gray-600 font-medium text-sm">
                        انقر لاختيار الصور أو قم بسحبها وإفلاتها هنا
                      </span>
                      <span className="text-gray-400 text-xs mt-1">
                        (يدعم: jpg, png, webp - الحد الأقصى 5MB)
                      </span>
                    </label>
                  </div>

                  {/* Previews */}
                  {imagePreviews.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">الصور الجديدة المضافة:</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {imagePreviews.map((src, i) => (
                          <div key={i} className="relative group rounded-xl border border-gray-200 overflow-hidden">
                            <img src={src} alt="" className="w-full h-20 object-cover" />
                            <button
                              type="button"
                              onClick={() => removeSpecificImage(i)}
                              className="absolute top-1 left-1 p-1 bg-red-600/90 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {editingItem?.images?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-2">الصور المحفوظة مسبقاً:</p>
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {editingItem.images.map((path, i) => (
                          <div key={i} className="relative rounded-xl border border-gray-200 overflow-hidden">
                            <img src={`${imageBaseUrl}/project_notes_images/${path.split('/').pop()}`} alt="" className="w-full h-20 object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting}
                  className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 font-semibold"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  {editingItem ? 'حفظ' : 'إضافة'}
                </button>
                <button type="button" onClick={closeModal} className="px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200">إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SponsorshipItems;
