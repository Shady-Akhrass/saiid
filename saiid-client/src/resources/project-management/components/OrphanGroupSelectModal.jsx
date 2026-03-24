import React, { useState, useEffect, useMemo } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { X, Users, Search } from 'lucide-react';
import { useDebounce } from '../../../hooks/useDebounce';

// Modal اختيار مجموعة الأيتام
export const OrphanGroupSelectModal = ({ isOpen, onClose, projectId, project, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [orphanGroups, setOrphanGroups] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState('');

    // ✅ استخدام debounce للبحث لتجنب إرسال طلبات كثيرة
    const debouncedSearchQuery = useDebounce(searchQuery, 500);

    // ✅ فلترة مجموعات الأيتام حسب البحث (في Frontend فقط)
    const filteredGroups = useMemo(() => {
        if (!debouncedSearchQuery.trim()) {
            return orphanGroups;
        }

        const query = debouncedSearchQuery.toLowerCase().trim();
        return orphanGroups.filter(group => {
            const groupName = (group.name || '').toLowerCase();
            const description = (group.description || '').toLowerCase();
            const governorate = (group.governorate_filter || '').toLowerCase();

            return groupName.includes(query) ||
                description.includes(query) ||
                governorate.includes(query);
        });
    }, [orphanGroups, debouncedSearchQuery]);

    // ✅ جلب مجموعات الأيتام فقط عند فتح الـ Modal
    useEffect(() => {
        if (isOpen) {
            fetchOrphanGroups();
        }
    }, [isOpen]);

    const fetchOrphanGroups = async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/orphan-groupings', {
                params: {
                    _t: Date.now(),
                },
            });
            
            if (response.data.success) {
                const groups = response.data.groupings || [];
                // ✅ فلترة المجموعات النشطة فقط
                const activeGroups = groups.filter(group => group.status === 'active');
                setOrphanGroups(activeGroups);
            } else {
                toast.error('فشل جلب مجموعات الأيتام');
            }
        } catch (error) {
            console.error('Error fetching orphan groups:', error);
            toast.error('حدث خطأ أثناء جلب مجموعات الأيتام');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedGroupId) {
            toast.error('يرجى اختيار مجموعة الأيتام');
            return;
        }

        try {
            setLoading(true);
            
            // ✅ تحديث المشروع بمجموعة الأيتام المختارة
            const response = await apiClient.put(`/project-proposals/${projectId}`, {
                orphan_group_id: selectedGroupId,
            });

            if (response.data.success) {
                toast.success('تم تحديد مجموعة الأيتام بنجاح');
                onSuccess && onSuccess();
                onClose();
            } else {
                toast.error(response.data.message || 'فشل تحديث مجموعة الأيتام');
            }
        } catch (error) {
            console.error('Error updating orphan group:', error);
            toast.error(error.response?.data?.message || 'حدث خطأ أثناء تحديث مجموعة الأيتام');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setSelectedGroupId('');
            setSearchQuery('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-gray-800">اختيار مجموعة الأيتام</h2>
                        <button
                            onClick={handleClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                            disabled={loading}
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    {project && (
                        <p className="text-sm text-gray-600 mt-2">
                            المشروع: {project.project_name || project.name || 'غير محدد'}
                        </p>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {/* البحث */}
                    <div className="mb-6">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="البحث عن مجموعة الأيتام..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* قائمة المجموعات */}
                    <div className="mb-6 max-h-60 overflow-y-auto">
                        {loading ? (
                            <div className="text-center py-8">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
                                <p className="text-gray-500 mt-2">جاري التحميل...</p>
                            </div>
                        ) : filteredGroups.length > 0 ? (
                            <div className="space-y-2">
                                {filteredGroups.map((group) => (
                                    <label
                                        key={group.id}
                                        className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <input
                                            type="radio"
                                            name="orphanGroup"
                                            value={group.id}
                                            checked={selectedGroupId === group.id}
                                            onChange={(e) => setSelectedGroupId(e.target.value)}
                                            className="ml-3 w-4 h-4 text-purple-600 focus:ring-purple-500"
                                            disabled={loading}
                                        />
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">
                                                {group.name}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                {group.description}
                                            </p>
                                            <div className="flex items-center gap-4 mt-1">
                                                <span className="text-xs text-gray-500">
                                                    السعة: {group.current_count || 0}/{group.max_capacity || 0}
                                                </span>
                                                {group.governorate_filter && (
                                                    <span className="text-xs text-gray-500">
                                                        المحافظة: {group.governorate_filter}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="ml-3">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                                group.status === 'active' 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-gray-100 text-gray-800'
                                            }`}>
                                                {group.status === 'active' ? 'نشط' : group.status}
                                            </span>
                                        </div>
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8">
                                <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                                <p className="text-gray-500">
                                    {searchQuery.trim() ? 'لا توجد نتائج للبحث' : 'لا توجد مجموعات أيتام نشطة'}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* الأزرار */}
                    <div className="flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                            disabled={loading}
                        >
                            إلغاء
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !selectedGroupId}
                            className="px-6 py-2 bg-purple-500 text-white rounded-lg font-medium hover:bg-purple-600 transition-colors disabled:opacity-50"
                        >
                            {loading ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default OrphanGroupSelectModal;
