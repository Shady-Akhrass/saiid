import React, { useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useToast } from "../../../hooks/useToast";
import {
  Download,
  Users,
  BarChart3,
  TrendingUp,
  MapPin
} from "lucide-react";

const OrphanGroupingsSimple = () => {
  const { user } = useAuth();
  const { success, error } = useToast();
  const [groupings, setGroupings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Simple fetch function without complex dependencies
  const fetchGroupings = async () => {
    try {
      const response = await fetch('/api/orphan-groupings');
      const data = await response.json();
      
      if (data.success) {
        setGroupings(data.groupings || []);
        success('تم تحميل البيانات بنجاح');
      } else {
        error('فشل في تحميل البيانات');
      }
    } catch (err) {
      error('حدث خطأ: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Check if user is admin
  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl p-8 max-w-md mx-4">
          <h2 className="text-2xl font-bold text-red-600 mb-4">وصول مرفوض</h2>
          <p className="text-gray-600 mb-6">ليس لديك صلاحيات للوصول إلى هذه الصفحة.</p>
          <div className="text-sm text-gray-500">
            <p>الدور المطلوب: <span className="font-semibold">مدير</span></p>
            <p>دورك الحالي: <span className="font-semibold">{user?.role || 'غير محدد'}</span></p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Cairo, Tajawal, Arial, sans-serif' }} className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/20 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 rounded-2xl p-6 text-white shadow-xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700 }}>
                تجميعات الأيتام
              </h1>
              <p className="text-sky-100">
                عرض وتحليل بيانات تجميعات الأيتام حسب المحافظة والمنطقة
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm"
              >
                إنشاء تجميعة جديدة
              </button>
              <button
                onClick={fetchGroupings}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm"
              >
                تحديث البيانات
              </button>
            </div>
          </div>
        </div>

        {groupings.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المحافظة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">المنطقة</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">عدد الأيتام</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">متوسط العمر</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الذكور</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الإناث</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">مشاكل صحية</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">في الحفظ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {groupings.map((grouping, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{grouping.governorate}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grouping.district}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          {grouping.orphan_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{grouping.average_age?.toFixed(1)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Users className="w-3 h-3" />
                          {grouping.male_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                          <Users className="w-3 h-3" />
                          {grouping.female_count}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {grouping.health_issues_count > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <Users className="w-3 h-3" />
                            {grouping.health_issues_count}
                          </span>
                        ) : (
                          <span className="text-green-600">لا يوجد</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {grouping.in_memorization_count > 0 ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <Users className="w-3 h-3" />
                            {grouping.in_memorization_count}
                          </span>
                        ) : (
                          <span className="text-gray-400">لا يوجد</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md mx-4 w-full">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-900">إنشاء تجميعة جديدة</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={(e) => {
                e.preventDefault();
                success('تم إنشاء التجميعة بنجاح');
                setShowCreateModal(false);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">المحافظة</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="أدخل اسم المحافظة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">المنطقة</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="أدخل اسم المنطقة"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الوصف</label>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows="3"
                    placeholder="أدخل وصف التجميعة"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold"
                  >
                    إنشاء تجميعة
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 py-2 px-4 rounded-lg font-semibold"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        )}
      </div>
    );
};

export default OrphanGroupingsSimple;
