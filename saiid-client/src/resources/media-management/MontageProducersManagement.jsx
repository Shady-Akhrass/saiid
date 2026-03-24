import React, { useState, useEffect } from 'react';
import apiClient from '../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Plus, Users, Edit, Trash2, UserCheck, UserX, Search, Eye, BarChart3, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';

const MontageProducersManagement = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [producers, setProducers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    perPage: 10,
    total: 0,
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProducer, setSelectedProducer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    code: '',
    phone_number: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isActiveFilter, setIsActiveFilter] = useState(null);

  useEffect(() => {
    fetchProducers();
  }, [searchQuery, pagination.currentPage, isActiveFilter]);

  // ✅ تحديث عنوان الصفحة (Tab Title) ديناميكياً
  useEffect(() => {
    document.title = 'إدارة الممنتجين';
  }, []);

  const fetchProducers = async () => {
    try {
      setLoading(true);
      const params = {
        perPage: pagination.perPage,
        page: pagination.currentPage,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      if (isActiveFilter !== null) {
        params.is_active = isActiveFilter;
      }

      const response = await apiClient.get('/montage-producers', { params });

      if (response.data.success) {
        setProducers(response.data.producers || []);
        setPagination({
          currentPage: response.data.currentPage || 1,
          totalPages: response.data.totalPages || 1,
          perPage: response.data.perPage || 10,
          total: response.data.total || 0,
        });
      }
    } catch (error) {
      console.error('Error fetching producers:', error);
      toast.error(error.response?.data?.message || 'فشل تحميل الممنتجين');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: null });
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'الاسم مطلوب';
    }

    if (!formData.email && !formData.code) {
      newErrors.email = 'البريد الإلكتروني أو الكود مطلوب';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // ✅ تعريف payload خارج try block حتى يكون متاحاً في catch
    let payload = {
      name: formData.name.trim(),
    };

    // ✅ إضافة email أو code (أحدهما مطلوب)
    if (formData.email && formData.email.trim()) {
      payload.email = formData.email.trim();
    } else if (formData.code && formData.code.trim()) {
      payload.code = formData.code.trim();
    }

    // ✅ إضافة phone_number فقط إذا كان موجوداً وليس فارغاً
    if (formData.phone_number && formData.phone_number.trim()) {
      // ✅ تنظيف رقم الجوال: إزالة المسافات والأحرف الخاصة (إبقاء الأرقام فقط)
      let phoneNumber = formData.phone_number.trim().replace(/\s+/g, '').replace(/[^\d]/g, '');

      // ✅ إذا كان الرقم يبدأ بـ +972 أو 00972 أو 972، نحوله إلى الصيغة المحلية (05)
      if (phoneNumber.startsWith('972') && phoneNumber.length >= 12) {
        // ✅ إزالة 972 من البداية
        phoneNumber = phoneNumber.substring(3);
        // ✅ إضافة 0 في البداية
        phoneNumber = `0${phoneNumber}`;
      } else if (phoneNumber.startsWith('00972') && phoneNumber.length >= 13) {
        // ✅ إزالة 00972 من البداية
        phoneNumber = phoneNumber.substring(5);
        // ✅ إضافة 0 في البداية
        phoneNumber = `0${phoneNumber}`;
      }

      // ✅ التأكد من أن الرقم يبدأ بـ 05
      if (!phoneNumber.startsWith('05')) {
        // ✅ إذا كان الرقم يبدأ بـ 5 فقط، نضيف 0 في البداية
        if (phoneNumber.startsWith('5')) {
          phoneNumber = `0${phoneNumber}`;
        } else {
          // ✅ إذا لم يبدأ بـ 05 أو 5، نضيف 05 في البداية
          phoneNumber = `05${phoneNumber}`;
        }
      }

      // ✅ التأكد من أن الرقم يتكون من 10 أرقام (05 + 8 أرقام)
      if (phoneNumber.length !== 10) {
        // ✅ إذا كان الرقم أطول من 10، نأخذ أول 10 أرقام
        if (phoneNumber.length > 10) {
          phoneNumber = phoneNumber.substring(0, 10);
        } else {
          // ✅ إذا كان الرقم أقصر من 10، نضيف أصفار في النهاية
          phoneNumber = phoneNumber.padEnd(10, '0');
        }
      }

      payload.phone_number = phoneNumber;
    }

    // ✅ إضافة password فقط إذا كان موجوداً وليس فارغاً (أو عند الإنشاء)
    if (formData.password && formData.password.trim()) {
      payload.password = formData.password.trim();
    }
    // ✅ عند التحديث، إذا لم يتم إدخال كلمة مرور، لا نرسلها (لن يتم تغييرها)
    // ✅ عند الإنشاء، إذا لم يتم إدخال كلمة مرور، لا نرسلها (الـ Backend سيستخدم كلمة مرور افتراضية)

    try {
      setLoading(true);

      let response;
      if (selectedProducer) {
        // تحديث
        response = await apiClient.put(`/montage-producers/${selectedProducer.id}`, payload);
      } else {
        // إضافة جديد
        response = await apiClient.post('/montage-producers', payload);
      }

      if (response.data.success) {
        toast.success(response.data.message || 'تم الحفظ بنجاح');
        setShowCreateModal(false);
        resetForm();
        fetchProducers();
      }
    } catch (error) {
      console.error('Error saving producer:', error);

      // ✅ عرض رسالة خطأ أكثر تفصيلاً
      let errorMessage = 'فشل حفظ البيانات';

      if (error.response?.data) {
        const errorData = error.response.data;

        // ✅ عرض رسالة الخطأ من الـ Backend
        if (errorData.message) {
          errorMessage = errorData.message;
        }

        // ✅ عرض أخطاء التحقق (validation errors) إن وجدت
        if (errorData.errors && typeof errorData.errors === 'object') {
          const validationErrors = Object.values(errorData.errors).flat();
          if (validationErrors.length > 0) {
            errorMessage = validationErrors.join(', ');
          }
        }

        // ✅ في وضع التطوير، عرض تفاصيل الخطأ
        if (import.meta.env.DEV) {
          console.error('📋 Full error response:', {
            status: error.response.status,
            data: errorData,
            payload: payload,
            errors: errorData.errors,
          });

          // ✅ عرض تفاصيل أخطاء التحقق إن وجدت
          if (errorData.errors) {
            console.error('🔍 Validation Errors Details:');
            Object.keys(errorData.errors).forEach(field => {
              console.error(`  - ${field}:`, errorData.errors[field]);
            });
          }

          // ✅ عرض payload المرسل للتحقق
          console.error('📤 Payload sent:', JSON.stringify(payload, null, 2));

          // ✅ عرض تفاصيل أخطاء التحقق إن وجدت
          if (errorData.errors) {
            console.error('🔍 Validation Errors:', errorData.errors);
            Object.keys(errorData.errors).forEach(field => {
              console.error(`  - ${field}:`, errorData.errors[field]);
            });
          }
        }
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (producerId) => {
    if (!confirm('هل أنت متأكد من حذف هذا الممنتج؟')) {
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.delete(`/montage-producers/${producerId}`);

      if (response.data.success) {
        toast.success(response.data.message || 'تم الحذف بنجاح');
        fetchProducers();
      }
    } catch (error) {
      console.error('Error deleting producer:', error);

      // ✅ عرض رسالة خطأ أكثر تفصيلاً
      let errorMessage = 'فشل حذف الممنتج';

      if (error.response?.data) {
        const errorData = error.response.data;

        // ✅ عرض رسالة الخطأ من الـ Backend
        if (errorData.message) {
          errorMessage = errorData.message;
        }

        // ✅ التحقق من خطأ foreign key constraint
        const errorString = JSON.stringify(errorData).toLowerCase();
        if (errorString.includes('foreign key') ||
          errorString.includes('integrity constraint') ||
          errorString.includes('cannot delete') ||
          errorString.includes('project_timeline') ||
          errorString.includes('changed_by')) {
          errorMessage = 'لا يمكن حذف هذا الممنتج لأنه مرتبط بسجلات في النظام (مثل سجل حركة المشاريع). يرجى تعطيل الممنتج بدلاً من حذفه.';
        }

        // ✅ في وضع التطوير، عرض تفاصيل الخطأ
        if (import.meta.env.DEV) {
          console.error('📋 Delete error response:', {
            status: error.response.status,
            data: errorData,
            producerId: producerId,
          });
        }
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (producerId) => {
    try {
      setLoading(true);

      // ✅ Debug: في وضع التطوير، عرض معلومات الطلب
      if (import.meta.env.DEV) {
        console.log('🔍 Fetching producer details:', {
          producerId: producerId,
          endpoint: `/montage-producers/${producerId}`
        });
      }

      const response = await apiClient.get(`/montage-producers/${producerId}`);

      // ✅ معالجة أشكال الاستجابة المختلفة
      let producerData = null;

      if (response.data) {
        if (response.data.success !== undefined) {
          if (response.data.success) {
            producerData = response.data.producer || response.data.data || response.data;
          } else {
            const errorMessage = response.data.message || response.data.error || 'فشل جلب تفاصيل الممنتج';
            toast.error(errorMessage);
            if (import.meta.env.DEV) {
              console.error('❌ API returned success: false:', response.data);
            }
            return;
          }
        } else {
          // إذا لم تكن هناك success field، نأخذ البيانات مباشرة
          producerData = response.data.producer || response.data.data || response.data;
        }
      }

      if (!producerData) {
        toast.error('الممنتج غير موجود أو لا يمكن الوصول إليه');
        if (import.meta.env.DEV) {
          console.error('❌ No producer data found in response:', response.data);
        }
        return;
      }

      // ✅ Debug: في وضع التطوير، عرض البيانات
      if (import.meta.env.DEV) {
        console.log('✅ Producer Data loaded successfully:', {
          id: producerData.id,
          name: producerData.name,
          hasStatistics: !!producerData.statistics,
          allKeys: Object.keys(producerData)
        });
      }

      // ✅ إعداد البيانات بالشكل المتوقع
      const formattedData = {
        producer: producerData.producer || producerData,
        statistics: producerData.statistics || null
      };

      setSelectedProducer(formattedData);
      setShowDetailsModal(true);
    } catch (error) {
      console.error('❌ Error fetching producer details:', error);

      // ✅ معالجة أفضل للأخطاء
      let errorMessage = 'فشل تحميل تفاصيل الممنتج';

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        if (status === 404) {
          errorMessage = 'الممنتج غير موجود';
        } else if (status === 403) {
          errorMessage = 'ليس لديك صلاحيات للوصول إلى هذا الممنتج';
        } else if (status === 500) {
          // ✅ خطأ في الـ Backend - عرض رسالة واضحة
          errorMessage = data?.message || data?.error || 'خطأ في الخادم. يرجى المحاولة لاحقاً أو الاتصال بالدعم الفني';

          // ✅ في وضع التطوير، عرض تفاصيل الخطأ
          if (import.meta.env.DEV) {
            console.error('❌ Backend Error (500):', {
              message: data?.message,
              error: data?.error,
              fullResponse: data
            });

            // ✅ إذا كان الخطأ متعلق بـ whereRaw على Collection
            if (data?.message?.includes('whereRaw') || data?.error?.includes('whereRaw')) {
              console.error('⚠️ Backend Issue: استخدام whereRaw على Collection بدلاً من Query Builder');
              console.error('💡 الحل: يجب إصلاح الكود في الـ Backend - استخدام Query Builder قبل get() أو first()');
            }
          }
        } else if (data?.message) {
          errorMessage = data.message;
        } else if (data?.error) {
          errorMessage = data.error;
        } else {
          errorMessage = `خطأ في الخادم (${status})`;
        }
      } else if (error.request) {
        errorMessage = 'لا يمكن الاتصال بالخادم. يرجى التحقق من الاتصال بالإنترنت';
      } else {
        errorMessage = `خطأ في الطلب: ${error.message}`;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (producer) => {
    setSelectedProducer(producer);
    setFormData({
      name: producer.name || '',
      email: producer.email || '',
      code: producer.code || '',
      phone_number: producer.phone_number || '',
      password: '',
    });
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      code: '',
      phone_number: '',
      password: '',
    });
    setSelectedProducer(null);
    setErrors({});
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    resetForm();
  };

  const filteredProducers = producers;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6" style={ { fontFamily: 'Cairo, sans-serif' } }>
      <div className="max-w-7xl mx-auto">
        {/* Header */ }
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">إدارة الممنتجين</h1>
            <p className="text-gray-600 mt-1">إدارة وإضافة الممنتجين</p>
          </div>
          <button
            onClick={ () => {
              resetForm();
              setShowCreateModal(true);
            } }
            className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
          >
            <Plus className="w-5 h-5" />
            إضافة ممنتج
          </button>
        </div>

        {/* Filters */ }
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="بحث بالاسم، البريد الإلكتروني، أو رقم الجوال..."
                value={ searchQuery }
                onChange={ (e) => {
                  setSearchQuery(e.target.value);
                  setPagination({ ...pagination, currentPage: 1 });
                } }
                className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <select
              value={ isActiveFilter === null ? '' : isActiveFilter }
              onChange={ (e) => {
                setIsActiveFilter(e.target.value === '' ? null : e.target.value === 'true');
                setPagination({ ...pagination, currentPage: 1 });
              } }
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="">جميع الحالات</option>
              <option value="true">نشط</option>
              <option value="false">معطل</option>
            </select>
          </div>
        </div>

        {/* Producers Table */ }
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          { loading && producers.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
            </div>
          ) : filteredProducers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">لا توجد نتائج</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">الاسم</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">البريد الإلكتروني / الكود</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">رقم الجوال</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">عدد المشاريع</th>
                      <th className="text-right py-4 px-6 text-sm font-semibold text-gray-700">الحالة</th>
                      <th className="text-center py-4 px-6 text-sm font-semibold text-gray-700">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    { filteredProducers.map((producer) => (
                      <tr key={ producer.id } className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-6 text-sm font-medium text-gray-800">{ producer.name }</td>
                        <td className="py-4 px-6 text-sm text-gray-700">{ producer.email || producer.code || '-' }</td>
                        <td className="py-4 px-6 text-sm text-gray-700">{ producer.phone_number || '-' }</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700 border border-purple-200">
                              { producer.projects_count !== undefined 
                                ? producer.projects_count 
                                : producer.total_projects !== undefined 
                                ? producer.total_projects 
                                : producer.statistics?.total_projects !== undefined
                                ? producer.statistics.total_projects
                                : '-' }
                            </span>
                            <span className="text-xs text-gray-500">مشروع</span>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          { producer.is_active ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                              <UserCheck className="w-4 h-4 ml-1" />
                              نشط
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                              <UserX className="w-4 h-4 ml-1" />
                              معطل
                            </span>
                          ) }
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={ () => handleViewDetails(producer.id) }
                              className="text-sky-600 hover:text-sky-700 p-2 hover:bg-sky-50 rounded-lg transition-colors"
                              title="عرض التفاصيل"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={ () => handleEdit(producer) }
                              className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                              title="تعديل"
                            >
                              <Edit className="w-5 h-5" />
                            </button>
                            <button
                              onClick={ () => handleDelete(producer.id) }
                              className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                            <Link
                              to={ `/media-management/producers/${producer.id}/projects` }
                              className="text-purple-600 hover:text-purple-700 p-2 hover:bg-purple-50 rounded-lg transition-colors"
                              title="مشاريع الممنتج"
                            >
                              <BarChart3 className="w-5 h-5" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )) }
                  </tbody>
                </table>
              </div>

              {/* Pagination */ }
              { pagination.totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                  <div className="text-sm text-gray-700">
                    عرض { ((pagination.currentPage - 1) * pagination.perPage) + 1 } إلى { Math.min(pagination.currentPage * pagination.perPage, pagination.total) } من { pagination.total }
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={ () => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 }) }
                      disabled={ pagination.currentPage === 1 }
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      السابق
                    </button>
                    <span className="px-4 py-2 text-gray-700">
                      صفحة { pagination.currentPage } من { pagination.totalPages }
                    </span>
                    <button
                      onClick={ () => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 }) }
                      disabled={ pagination.currentPage === pagination.totalPages }
                      className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      التالي
                    </button>
                  </div>
                </div>
              ) }
            </>
          ) }
        </div>

        {/* Create/Edit Modal */ }
        { showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">
                  { selectedProducer ? 'تعديل ممنتج' : 'إضافة ممنتج جديد' }
                </h2>
                <button
                  onClick={ handleCloseModal }
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={ handleSubmit } className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    الاسم <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={ formData.name }
                    onChange={ handleChange }
                    className={ `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent ${errors.name ? 'border-red-500' : 'border-gray-300'}` }
                    required
                  />
                  { errors.name && <p className="text-red-500 text-sm mt-1">{ errors.name }</p> }
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    البريد الإلكتروني
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={ formData.email }
                    onChange={ handleChange }
                    disabled={ !!formData.code }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    أو الكود
                  </label>
                  <input
                    type="text"
                    name="code"
                    value={ formData.code }
                    onChange={ handleChange }
                    disabled={ !!formData.email }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent disabled:bg-gray-100"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    رقم الجوال
                  </label>
                  <input
                    type="tel"
                    name="phone_number"
                    value={ formData.phone_number }
                    onChange={ handleChange }
                    placeholder="0599999999"
                    className={ `w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent ${errors.phone_number ? 'border-red-500' : 'border-gray-300'}` }
                  />
                  { errors.phone_number && <p className="text-red-500 text-sm mt-1">{ errors.phone_number }</p> }
                  <p className="text-xs text-gray-500 mt-1">
                    يجب أن يبدأ بـ 05 ويتكون من 10 أرقام (مثال: 0599999999)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    كلمة المرور { selectedProducer ? '(اتركه فارغاً للحفاظ على الكلمة الحالية)' : '(اختياري - سيتم استخدام كلمة مرور افتراضية)' }
                  </label>
                  <input
                    type="password"
                    name="password"
                    value={ formData.password }
                    onChange={ handleChange }
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={ loading }
                    className="flex-1 bg-gradient-to-r from-sky-500 to-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:shadow-lg transition-shadow disabled:opacity-50"
                  >
                    { loading ? 'جاري الحفظ...' : 'حفظ' }
                  </button>
                  <button
                    type="button"
                    onClick={ handleCloseModal }
                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                  >
                    إلغاء
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) }

        {/* Details Modal */ }
        { showDetailsModal && selectedProducer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">تفاصيل الممنتج</h2>
                <button
                  onClick={ () => setShowDetailsModal(false) }
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                {/* ✅ معالجة البيانات - دعم أشكال مختلفة */ }
                { (() => {
                  // ✅ الحصول على بيانات الممنتج (دعم أشكال مختلفة)
                  const producer = selectedProducer.producer || selectedProducer;

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
                          <p className="text-gray-900">{ producer?.name || '-' }</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني / الكود</label>
                          <p className="text-gray-900">{ producer?.email || producer?.code || '-' }</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">رقم الجوال</label>
                          <p className="text-gray-900">{ producer?.phone_number || '-' }</p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">الحالة</label>
                          <p className="text-gray-900">
                            { producer?.is_active !== undefined ? (producer.is_active ? 'نشط' : 'معطل') : '-' }
                          </p>
                        </div>
                      </div>

                      {/* ✅ رسالة تحذيرية إذا كان هناك خطأ في الـ Backend */ }
                      { import.meta.env.DEV && !selectedProducer.statistics && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                          <p className="text-sm text-yellow-800">
                            ⚠️ الإحصائيات غير متوفرة - قد يكون هناك خطأ في الـ Backend
                          </p>
                        </div>
                      ) }
                    </>
                  );
                })() }

                { selectedProducer.statistics ? (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">الإحصائيات</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">إجمالي المشاريع</p>
                        <p className="text-2xl font-bold text-blue-600">{ selectedProducer.statistics.total_projects || 0 }</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">المشاريع الحالية</p>
                        <p className="text-2xl font-bold text-purple-600">{ selectedProducer.statistics.current_projects || 0 }</p>
                      </div>
                      <div className="bg-green-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">المشاريع المنجزة</p>
                        <p className="text-2xl font-bold text-green-600">{ selectedProducer.statistics.completed_projects || 0 }</p>
                      </div>
                      <div className="bg-indigo-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">المشاريع المسلمة</p>
                        <p className="text-2xl font-bold text-indigo-600">{ selectedProducer.statistics.delivered_projects || 0 }</p>
                      </div>
                      <div className="bg-amber-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">المشاريع المعاد منتاجها</p>
                        <p className="text-2xl font-bold text-amber-600">{ selectedProducer.statistics.redone_projects || 0 }</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">المشاريع المتأخرة</p>
                        <p className="text-2xl font-bold text-red-600">{ selectedProducer.statistics.delayed_projects || 0 }</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="w-5 h-5 text-yellow-600" />
                        <h3 className="text-lg font-semibold text-yellow-800">الإحصائيات غير متوفرة</h3>
                      </div>
                      <p className="text-sm text-yellow-700">
                        لا يمكن تحميل الإحصائيات بسبب خطأ في الخادم. يرجى المحاولة لاحقاً أو الاتصال بالدعم الفني.
                      </p>
                      { import.meta.env.DEV && (
                        <p className="text-xs text-yellow-600 mt-2 font-mono">
                          خطأ Backend: Method Illuminate\\Database\\Eloquent\\Collection::whereRaw does not exist
                        </p>
                      ) }
                    </div>
                  </div>
                ) }

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={ () => {
                      setShowDetailsModal(false);
                      // ✅ الحصول على بيانات الممنتج (دعم أشكال مختلفة)
                      const producer = selectedProducer.producer || selectedProducer;
                      handleEdit(producer);
                    } }
                    className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700"
                  >
                    تعديل
                  </button>
                  <Link
                    to={ `/media-management/producers/${selectedProducer.producer?.id}/projects` }
                    className="flex-1 bg-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-purple-700 text-center"
                  >
                    عرض المشاريع
                  </Link>
                  <button
                    onClick={ () => setShowDetailsModal(false) }
                    className="px-6 py-3 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) }
      </div>
    </div>
  );
};

export default MontageProducersManagement;
