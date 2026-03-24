import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Users,
  BarChart3,
  TrendingUp,
  Loader2,
  AlertCircle,
  Download,
  Eye,
} from 'lucide-react';
import Unauthorized from '../components/Unauthorized';
import PageLoader from '../../../components/PageLoader';

const BeneficiariesStatistics = () => {
  const { user, loading: authLoading } = useAuth();
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedAidType, setSelectedAidType] = useState(null);
  const [beneficiariesByType, setBeneficiariesByType] = useState([]);
  const [loadingBeneficiaries, setLoadingBeneficiaries] = useState(false);
  const [showBeneficiariesModal, setShowBeneficiariesModal] = useState(false);

  // التحقق من الصلاحيات
  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';

  const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

  useEffect(() => {
    if (!authLoading && user) {
      if (isAdmin) {
        fetchStatistics();
      }
    }
  }, [authLoading, user, isAdmin]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/beneficiaries/statistics');
      
      if (response.data.success) {
        setStatistics(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching statistics:', error);
      toast.error('حدث خطأ أثناء جلب الإحصائيات');
    } finally {
      setLoading(false);
    }
  };

  const fetchBeneficiariesByType = async (aidType) => {
    try {
      setLoadingBeneficiaries(true);
      setSelectedAidType(aidType);
      const response = await apiClient.get(
        `/beneficiaries/by-aid-type/${encodeURIComponent(aidType)}`
      );
      
      if (response.data.success) {
        setBeneficiariesByType(response.data.data || []);
        setShowBeneficiariesModal(true);
      }
    } catch (error) {
      console.error('Error fetching beneficiaries by type:', error);
      toast.error('حدث خطأ أثناء جلب المستفيدين');
    } finally {
      setLoadingBeneficiaries(false);
    }
  };

  const exportBeneficiariesByType = async (aidType) => {
    try {
      const response = await apiClient.get(
        `/beneficiaries/by-aid-type/${encodeURIComponent(aidType)}`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `beneficiaries_${aidType.replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('تم تصدير الملف بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء تصدير الملف');
    }
  };

  if (authLoading || loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Unauthorized requiredRole="admin" pageName="إحصائيات المستفيدين" />;
  }

  if (!isAdmin) {
    return <Unauthorized requiredRole="admin" pageName="إحصائيات المستفيدين" />;
  }

  if (!statistics) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">لا توجد بيانات</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-lg mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gradient-to-br from-sky-500 to-blue-600 rounded-xl">
                <BarChart3 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-800">إحصائيات المستفيدين</h1>
                <p className="text-gray-500 mt-1">إحصائيات شاملة للمستفيدين حسب نوع المساعدة</p>
              </div>
            </div>
          </div>
        </div>

        {/* Total Statistics Card */}
        <div className="bg-gradient-to-br from-sky-50 to-blue-50 rounded-2xl p-6 shadow-lg mb-6 border-2 border-sky-200">
          <div className="flex items-center gap-3 mb-4">
            <TrendingUp className="w-6 h-6 text-sky-600" />
            <h2 className="text-xl font-bold text-gray-800">إجمالي المستفيدين الفريدين</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-xl p-6 border-2 border-sky-300">
              <p className="text-sm text-gray-600 mb-2">المجموع الكلي</p>
              <p className="text-4xl font-bold text-sky-600">
                {statistics.total_unique_beneficiaries?.toLocaleString('ar-EG') || 0}
              </p>
            </div>
            <div className="flex-1">
              <p className="text-sm text-gray-600">
                عدد المستفيدين الفريدين (بدون تكرار) حسب رقم الهوية عبر جميع أنواع المساعدة
              </p>
            </div>
          </div>
        </div>

        {/* Statistics by Aid Type */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
            <Users className="w-6 h-6 text-gray-600" />
            حسب نوع المساعدة
          </h2>

          {statistics.by_aid_type && statistics.by_aid_type.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {statistics.by_aid_type.map((item, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200 hover:shadow-lg transition-all"
                >
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-800">{item.aid_type || 'غير محدد'}</h3>
                    <Users className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="mb-4">
                    <p className="text-3xl font-bold text-sky-600 mb-2">
                      {item.unique_beneficiaries_count?.toLocaleString('ar-EG') || 0}
                    </p>
                    <p className="text-sm text-gray-500">مستفيد فريد</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchBeneficiariesByType(item.aid_type)}
                      disabled={loadingBeneficiaries}
                      className="flex-1 px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {loadingBeneficiaries && selectedAidType === item.aid_type ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>جاري التحميل...</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>عرض المستفيدين</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => exportBeneficiariesByType(item.aid_type)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                      title="تصدير إلى Excel"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">لا توجد بيانات</p>
            </div>
          )}
        </div>

        {/* Modal for Beneficiaries List */}
        {showBeneficiariesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      المستفيدين من نوع: {selectedAidType}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      إجمالي: {beneficiariesByType.length} مستفيد فريد
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => exportBeneficiariesByType(selectedAidType)}
                      className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" />
                      <span>تصدير</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowBeneficiariesModal(false);
                        setBeneficiariesByType([]);
                        setSelectedAidType(null);
                      }}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    >
                      إغلاق
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-6">
                {loadingBeneficiaries ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                  </div>
                ) : beneficiariesByType.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">لا يوجد مستفيدين</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">الاسم</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم الهوية</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">رقم الهاتف</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المحافظة</th>
                          <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">المنطقة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {beneficiariesByType.map((beneficiary, index) => (
                          <tr key={index} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-3 text-sm text-gray-800">{beneficiary.name || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700 font-mono">{beneficiary.id_number || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.phone || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.governorate || '-'}</td>
                            <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.district || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeneficiariesStatistics;

