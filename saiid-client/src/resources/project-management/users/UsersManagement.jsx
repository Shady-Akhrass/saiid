import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { Plus, Users, Camera, Edit, Trash2, UserCheck, UserX, Search } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

const UsersManagement = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone_number: '',
    password: '',
    department: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    let loadingTimeout;
    
    try {
      // setLoading(true);
      
      // إيقاف حالة التحميل بعد timeout
      loadingTimeout = setTimeout(() => {
        setLoading(false);
        setUsers([]);
      }, 5000); // timeout 5 ثواني
      
      // ✅ جلب جميع المستخدمين من endpoints متعددة ودمجهم
      const [executorsResponse, photographersResponse] = await Promise.allSettled([
        apiClient.get('/executors', { timeout: 5000 }),
        apiClient.get('/photographers-list', { timeout: 5000 }),
      ]);
      
      const allUsers = [];
      
      // 🔍 جلب المنفذين
      if (executorsResponse.status === 'fulfilled' && executorsResponse.value?.data?.success) {
        const executors = 
          executorsResponse.value.data.data || 
          executorsResponse.value.data.executors || 
          executorsResponse.value.data.data?.data || 
          [];
        
        // إضافة role للمنفذين إذا لم يكن موجوداً
        const executorsWithRole = Array.isArray(executors) 
          ? executors.map(user => ({ ...user, role: user.role || 'executor' }))
          : [];
        
        allUsers.push(...executorsWithRole);
        console.log('✅ Executors loaded:', executorsWithRole.length);
      } else if (executorsResponse.status === 'rejected') {
        console.warn('⚠️ Failed to load executors:', executorsResponse.reason);
      }
      
      // 🔍 جلب المصورين
      if (photographersResponse.status === 'fulfilled' && photographersResponse.value?.data?.success) {
        const photographers = 
          photographersResponse.value.data.photographers || 
          photographersResponse.value.data.data || 
          photographersResponse.value.data.data?.data || 
          [];
        
        // إضافة role للمصورين إذا لم يكن موجوداً
        const photographersWithRole = Array.isArray(photographers)
          ? photographers.map(user => ({ ...user, role: user.role || 'photographer' }))
          : [];
        
        allUsers.push(...photographersWithRole);
        console.log('✅ Photographers loaded:', photographersWithRole.length);
      } else if (photographersResponse.status === 'rejected') {
        console.warn('⚠️ Failed to load photographers:', photographersResponse.reason);
      }
      
      // 🔍 محاولة جلب المستخدمين الآخرين (Admin, Project Manager, etc.)
      // إذا كان هناك endpoint آخر متاح
      try {
        // محاولة جلب من endpoint عام إذا كان موجوداً
        const allUsersResponse = await apiClient.get('/users', { timeout: 5000 });
        if (allUsersResponse.data?.success) {
          const additionalUsers = 
            allUsersResponse.data.users || 
            allUsersResponse.data.data || 
            [];
          
          // دمج المستخدمين الجدد مع تجنب التكرار
          const existingIds = new Set(allUsers.map(u => u.id));
          const newUsers = Array.isArray(additionalUsers)
            ? additionalUsers.filter(u => !existingIds.has(u.id))
            : [];
          
          allUsers.push(...newUsers);
          if (import.meta.env.DEV) {
            console.log('✅ Additional users loaded:', newUsers.length);
          }
        }
      } catch (error) {
        // تجاهل الخطأ إذا كان endpoint غير موجود
        if (import.meta.env.DEV) {
          console.log('ℹ️ /users endpoint not available, using executors and photographers only');
        }
      }
      
      if (loadingTimeout) clearTimeout(loadingTimeout);
      
      if (import.meta.env.DEV) {
        console.log('📋 Total users loaded:', allUsers.length);
      }
      
      setUsers(allUsers);
      
      if (allUsers.length === 0) {
        toast.warning('لم يتم العثور على أي مستخدمين');
      }
    } catch (error) {
      if (loadingTimeout) clearTimeout(loadingTimeout);
      
      setUsers([]);
      
      if (import.meta.env.DEV && !error.isConnectionError) {
        console.error('Error fetching users:', error);
      }
      
      if (!error.isConnectionError) {
        toast.error(error.userMessage || 'فشل تحميل المستخدمين');
      }
    } finally {
      if (loadingTimeout) clearTimeout(loadingTimeout);
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
    if (!formData.email.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'البريد الإلكتروني غير صحيح';
    }
    if (!formData.password || formData.password.length < 6) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = 'رقم الهاتف مطلوب';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      toast.error('الرجاء تصحيح الأخطاء في النموذج');
      return;
    }

    try {
      const endpoint = user?.role === 'media_manager' 
        ? '/photographers-management' 
        : '/executors';
      
      const response = await apiClient.post(endpoint, {
        name: formData.name,
        email: formData.email,
        phone_number: formData.phone_number,
        password: formData.password,
        department: formData.department || null,
      });

      if (response.data.success) {
        toast.success('تم إضافة المستخدم بنجاح');
        setShowCreateModal(false);
        setFormData({
          name: '',
          email: '',
          phone_number: '',
          password: '',
          department: '',
        });
        fetchUsers();
      } else {
        toast.error(response.data.message || 'فشل إضافة المستخدم');
      }
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error.userMessage || 'حدث خطأ أثناء إضافة المستخدم');
      if (error.response?.data?.errors) {
        setErrors(error.response.data.errors);
      }
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      const response = await apiClient.patch(`/users/${userId}/toggle-status`);
      if (response.data.success) {
        toast.success('تم تحديث حالة المستخدم بنجاح');
        fetchUsers();
      }
    } catch (error) {
      console.error('Error toggling user status:', error);
      toast.error(error.userMessage || 'حدث خطأ');
    }
  };

  const filteredUsers = users.filter((u) => {
    const query = searchQuery.toLowerCase();
    return (
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.phone_number?.includes(query) ||
      getRoleLabel(u.role)?.toLowerCase().includes(query) ||
      u.department?.toLowerCase().includes(query)
    );
  });

  // ✅ عرض جميع المستخدمين بغض النظر عن الدور
  const getRoleLabel = (role) => {
    const roleLabels = {
      'admin': 'مدير',
      'project_manager': 'مدير مشاريع',
      'media_manager': 'مدير إعلام',
      'executed_projects_coordinator': 'منسق مشاريع منفذة',
      'executor': 'منفذ',
      'photographer': 'مصور',
    };
    return roleLabels[role] || role || 'غير محدد';
  };

  const getRoleColor = (role) => {
    const roleColors = {
      'admin': 'bg-purple-100 text-purple-700',
      'project_manager': 'bg-blue-100 text-blue-700',
      'media_manager': 'bg-orange-100 text-orange-700',
      'executed_projects_coordinator': 'bg-green-100 text-green-700',
      'executor': 'bg-sky-100 text-sky-700',
      'photographer': 'bg-amber-100 text-amber-700',
    };
    return roleColors[role] || 'bg-gray-100 text-gray-700';
  };

  // if (loading) {
  //   return (
  //     <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
  //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
  //     </div>
  //   );
  // }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">إدارة المستخدمين</h1>
            <p className="text-gray-600 mt-1">عرض وإدارة جميع مستخدمي النظام</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-6 py-3 rounded-xl font-medium flex items-center hover:shadow-lg transition-shadow"
          >
            <Plus className="w-5 h-5 ml-2" />
            إضافة مستخدم جديد
          </button>
        </div>

        {/* Search */}
        <div className="bg-white rounded-2xl p-6 shadow-lg">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="بحث بالاسم، البريد الإلكتروني، أو رقم الهاتف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-sky-500 to-blue-600 text-white">
                <tr>
                  <th className="text-right py-4 px-6 text-sm font-semibold">الاسم</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">البريد الإلكتروني</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">رقم الهاتف</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">الدور</th>
                  <th className="text-right py-4 px-6 text-sm font-semibold">القسم</th>
                  <th className="text-center py-4 px-6 text-sm font-semibold">الحالة</th>
                  <th className="text-center py-4 px-6 text-sm font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-12 text-center text-gray-500">
                      <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                      <p>لا يوجد مستخدمين</p>
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((userItem) => (
                    <tr key={userItem.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-6 text-sm font-medium text-gray-800">
                        {userItem.name || '-'}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        {userItem.email || '-'}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        {userItem.phone_number || '-'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(
                            userItem.role
                          )}`}
                        >
                          {getRoleLabel(userItem.role)}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        {userItem.department || '-'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            userItem.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {userItem.is_active ? 'نشط' : 'معطل'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleToggleStatus(userItem.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              userItem.is_active
                                ? 'bg-red-100 hover:bg-red-200 text-red-700'
                                : 'bg-green-100 hover:bg-green-200 text-green-700'
                            }`}
                            title={userItem.is_active ? 'تعطيل' : 'تفعيل'}
                          >
                            {userItem.is_active ? (
                              <UserX className="w-4 h-4" />
                            ) : (
                              <UserCheck className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800">إضافة مستخدم جديد</h2>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setFormData({
                      name: '',
                      email: '',
                      phone_number: '',
                      password: '',
                      department: '',
                    });
                    setErrors({});
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      الاسم الكامل *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        errors.name ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      البريد الإلكتروني *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        errors.email ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      رقم الهاتف *
                    </label>
                    <input
                      type="tel"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        errors.phone_number ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.phone_number && (
                      <p className="text-red-500 text-sm mt-1">{errors.phone_number}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      كلمة المرور *
                    </label>
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                        errors.password ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.password && (
                      <p className="text-red-500 text-sm mt-1">{errors.password}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      القسم (اختياري)
                    </label>
                    <input
                      type="text"
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({
                        name: '',
                        email: '',
                        phone_number: '',
                        password: '',
                        department: '',
                      });
                      setErrors({});
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="bg-gradient-to-r from-sky-500 to-blue-600 text-white px-8 py-3 rounded-xl font-medium hover:shadow-lg transition-shadow"
                  >
                    إضافة مستخدم
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsersManagement;

