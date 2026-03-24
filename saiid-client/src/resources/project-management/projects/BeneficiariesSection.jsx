import React, { useState, useEffect } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { useAuth } from '../../../context/AuthContext';
import { toast } from 'react-toastify';
import {
  Users,
  Upload,
  Download,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle,
  X,
  Loader2,
  FileDown,
} from 'lucide-react';
import ConfirmDialog from '../../../components/ConfirmDialog';

const BeneficiariesSection = ({ projectId, projectStatus, subcategory }) => {
  const { user } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [file, setFile] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // التحقق من الصلاحيات
  const userRole = user?.role?.toLowerCase?.() ||
    user?.userRole?.toLowerCase?.() ||
    user?.user_role?.toLowerCase?.() ||
    user?.role_name?.toLowerCase?.() ||
    user?.role || '';

  const isAdmin = userRole === 'admin' || 
    userRole === 'administrator' || 
    userRole === 'مدير' ||
    userRole === 'مدير عام';
  
  const isExecutedCoordinator = userRole === 'executed_projects_coordinator' || 
    userRole === 'executedprojectscoordinator' ||
    userRole === 'منسق المشاريع المنفذة' ||
    userRole === 'منسق مشاريع منفذة';
  
  // حالات المشاريع المنفذة وما بعدها
  const executedStatuses = [
    'تم التنفيذ',
    'منفذ',
    'في المونتاج',
    'تم المونتاج',
    'معاد مونتاجه',
    'وصل للمتبرع'
  ];
  
  const canUpload = (isAdmin || isExecutedCoordinator) && executedStatuses.includes(projectStatus);
  const canDelete = isAdmin || isExecutedCoordinator;
  const canDownloadTemplate = (isAdmin || isExecutedCoordinator) && executedStatuses.includes(projectStatus);

  // جلب قائمة المستفيدين
  useEffect(() => {
    if (projectId) {
      fetchBeneficiaries();
    }
  }, [projectId]);

  const fetchBeneficiaries = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/project-proposals/${projectId}/beneficiaries`);
      
      if (response.data.success) {
        setBeneficiaries(response.data.data || []);
      }
    } catch (error) {
      if (error.response?.status !== 404) {
        console.error('Error fetching beneficiaries:', error);
      }
      setBeneficiaries([]);
    } finally {
      setLoading(false);
    }
  };

  // رفع ملف Excel
  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // التحقق من صيغة الملف
      const validExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = selectedFile.name.toLowerCase().substring(selectedFile.name.lastIndexOf('.'));
      
      if (!validExtensions.includes(fileExtension)) {
        toast.error('يجب أن يكون الملف بصيغة Excel (xlsx, xls, csv)');
        setFile(null);
        e.target.value = '';
        return;
      }

      // التحقق من حجم الملف (10 ميجابايت)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('حجم الملف يجب أن يكون أقل من 10 ميجابايت');
        setFile(null);
        e.target.value = '';
        return;
      }

      setFile(selectedFile);
      setMessage('');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('يرجى اختيار ملف Excel');
      return;
    }

    if (!canUpload) {
      toast.error('يمكن رفع ملف Excel فقط للمشاريع في حالة "تم التنفيذ" أو ما بعدها');
      return;
    }

    setUploading(true);
    setMessage('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post(
        `/project-proposals/${projectId}/beneficiaries/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (response.data.success) {
        toast.success(`تم رفع الملف بنجاح! تم استيراد ${response.data.imported_count} مستفيد`);
        setFile(null);
        setMessage('');
        // إعادة تحميل قائمة المستفيدين
        await fetchBeneficiaries();
        // إعادة تعيين input file
        const fileInput = document.getElementById('beneficiaries-file-input');
        if (fileInput) fileInput.value = '';
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'حدث خطأ أثناء رفع الملف';
      toast.error(errorMessage);
      setMessage(`❌ ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  // تصدير المستفيدين إلى Excel
  const handleExport = async () => {
    setExporting(true);
    
    try {
      const response = await apiClient.get(
        `/project-proposals/${projectId}/beneficiaries/export`,
        {
          responseType: 'blob',
        }
      );

      // إنشاء رابط تحميل
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `beneficiaries_project_${projectId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('تم تصدير الملف بنجاح');
    } catch (error) {
      toast.error('حدث خطأ أثناء تصدير الملف');
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  // تنزيل قالب Excel للمستفيدين
  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    setMessage('');
    
    try {
      const response = await apiClient.get(
        `/project-proposals/${projectId}/beneficiaries/template`,
        {
          responseType: 'blob',
        }
      );

      // إنشاء رابط تحميل
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `beneficiaries_template_project_${projectId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('✅ تم تنزيل القالب بنجاح! يمكنك الآن ملؤه بالبيانات ثم رفعه.');
      setMessage('✅ تم تنزيل القالب بنجاح! يمكنك الآن ملؤه بالبيانات ثم رفعه.');
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'حدث خطأ أثناء تنزيل القالب';
      toast.error(errorMessage);
      setMessage(`❌ ${errorMessage}`);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  // حذف المستفيدين
  const handleDelete = async () => {
    setDeleting(true);
    
    try {
      const response = await apiClient.delete(`/project-proposals/${projectId}/beneficiaries`);
      
      if (response.data.success) {
        toast.success(`تم حذف ${response.data.deleted_count} مستفيد بنجاح`);
        setBeneficiaries([]);
        setShowDeleteConfirm(false);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.response?.data?.error || 'حدث خطأ أثناء حذف المستفيدين';
      toast.error(errorMessage);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-sky-100 rounded-xl">
            <Users className="w-6 h-6 text-sky-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">المستفيدين</h2>
            <p className="text-sm text-gray-500">إدارة قائمة المستفيدين من المشروع</p>
          </div>
        </div>
        {beneficiaries.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-medium">
              {beneficiaries.length} مستفيد
            </span>
          </div>
        )}
      </div>

      {/* رفع ملف Excel */}
      {canUpload && (
        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Upload className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-800">رفع ملف Excel للمستفيدين</h3>
          </div>
          
          {/* تنزيل القالب */}
          {canDownloadTemplate && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileDown className="w-4 h-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">الخطوة 1: تنزيل القالب</span>
                </div>
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                  title="تنزيل قالب Excel فارغ لملؤه بالبيانات"
                >
                  {downloadingTemplate ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري التنزيل...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-4 h-4" />
                      <span>تنزيل قالب Excel</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-blue-700">
                قم بتنزيل قالب Excel فارغ يحتوي على الأعمدة المطلوبة ونوع المساعدة للمشروع
              </p>
            </div>
          )}
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {canDownloadTemplate ? 'الخطوة 2: رفع الملف المملوء' : 'رفع ملف Excel'}
              </label>
              <div>
                <input
                  id="beneficiaries-file-input"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {canDownloadTemplate 
                    ? 'بعد ملء القالب بالبيانات، قم برفعه هنا (أو يمكنك رفع أي ملف Excel آخر)'
                    : 'الملف يجب أن يكون بصيغة Excel (xlsx, xls, csv) وحجمه أقل من 10 ميجابايت'
                  }
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  الملف يجب أن يكون بصيغة Excel (xlsx, xls, csv) وحجمه أقل من 10 ميجابايت
                </p>
              </div>
            </div>

            {file && (
              <div className="flex items-center gap-2 p-2 bg-white rounded-lg border border-gray-200">
                <FileSpreadsheet className="w-4 h-4 text-green-600" />
                <span className="text-sm text-gray-700 flex-1">{file.name}</span>
                <button
                  onClick={() => {
                    setFile(null);
                    const fileInput = document.getElementById('beneficiaries-file-input');
                    if (fileInput) fileInput.value = '';
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="w-full px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري الرفع...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>رفع الملف</span>
                </>
              )}
            </button>

            {message && (
              <div className={`p-3 rounded-lg flex items-center gap-2 ${
                message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {message.includes('✅') ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertCircle className="w-5 h-5" />
                )}
                <span className="text-sm">{message}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!canUpload && executedStatuses.includes(projectStatus) && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              المشروع في حالة مناسبة لرفع ملف Excel، لكن ليس لديك صلاحيات للرفع. 
              الصلاحيات مقتصرة على الإدارة (Admin) أو منسق المشاريع المنفذة (Executed Projects Coordinator).
            </p>
          </div>
        </div>
      )}

      {!executedStatuses.includes(projectStatus) && (isAdmin || isExecutedCoordinator) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            <p className="text-sm text-blue-800">
              يمكن رفع ملف Excel للمستفيدين فقط للمشاريع في حالة "تم التنفيذ" أو ما بعدها. 
              حالة المشروع الحالية: <span className="font-semibold">{projectStatus}</span>
            </p>
          </div>
        </div>
      )}

      {/* أزرار الإجراءات */}
      {beneficiaries.length > 0 && (
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {exporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التصدير...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>تصدير إلى Excel</span>
              </>
            )}
          </button>

          {canDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>حذف المستفيدين</span>
            </button>
          )}
        </div>
      )}

      {/* قائمة المستفيدين */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
        </div>
      ) : beneficiaries.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">لا يوجد مستفيدين مسجلين لهذا المشروع</p>
          {canUpload && (
            <p className="text-sm text-gray-400 mt-2">قم برفع ملف Excel لإضافة المستفيدين</p>
          )}
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
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">نوع المساعدة</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((beneficiary) => (
                <tr key={beneficiary.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-gray-800">{beneficiary.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 font-mono">{beneficiary.id_number || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.governorate || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{beneficiary.district || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <span className="px-2 py-1 bg-sky-100 text-sky-700 rounded-full text-xs">
                      {beneficiary.aid_type || subcategory || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* تأكيد الحذف */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="حذف المستفيدين"
        message={`هل أنت متأكد من حذف جميع المستفيدين (${beneficiaries.length} مستفيد)؟ هذا الإجراء لا يمكن التراجع عنه.`}
        confirmText="حذف"
        cancelText="إلغاء"
        confirmButtonClass="bg-red-500 hover:bg-red-600"
        loading={deleting}
      />
    </div>
  );
};

export default BeneficiariesSection;

