import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvailableProjects, createArchive } from '../../../services/mediaArchiveService';
import { ArrowRight, X, Archive } from 'lucide-react';
import { toast } from 'react-toastify';

const NewArchive = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [formData, setFormData] = useState({
    project_proposal_id: '',
    archive_type: '',
    local_path: '',
    notes: '',
  });

  const [errors, setErrors] = useState({});
  const [selectedProject, setSelectedProject] = useState(null);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      setLoadingProjects(true);
      const data = await getAvailableProjects();
      setProjects(data || []);
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'فشل جلب المشاريع';
      toast.error(errorMessage);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));

    // Update selected project when project is selected
    if (name === 'project_proposal_id') {
      const project = projects.find(p => p.id === Number(value));
      setSelectedProject(project || null);
    }

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.project_proposal_id) {
      newErrors.project_proposal_id = 'يرجى اختيار المشروع';
    }

    if (!formData.archive_type) {
      newErrors.archive_type = 'يرجى اختيار نوع الأرشيف';
    }

    if (!formData.local_path || formData.local_path.trim() === '') {
      newErrors.local_path = 'يرجى إدخال مسار الملفات';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      setLoading(true);
      const data = {
        project_proposal_id: Number(formData.project_proposal_id),
        archive_type: formData.archive_type,
        local_path: formData.local_path.trim(),
        notes: formData.notes.trim() || undefined,
      };

      await createArchive(data);
      toast.success('تم إضافة الأرشيف بنجاح');
      // Reset form and selected project
      setSelectedProject(null);
      navigate('/media-management/archives');
    } catch (error) {
      const errorMessage = error.response?.data?.message || error.message || 'فشل إضافة الأرشيف';
      toast.error(errorMessage);

      // Handle validation errors
      if (error.response?.status === 422 && error.response?.data?.errors) {
        const validationErrors = {};
        Object.keys(error.response.data.errors).forEach(key => {
          validationErrors[key] = error.response.data.errors[key][0];
        });
        setErrors(validationErrors);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */ }
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Archive className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">إضافة أرشيف جديد</h1>
          </div>
          <button
            onClick={ () => navigate('/media-management/archives') }
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */ }
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <form onSubmit={ handleSubmit } className="space-y-6">
            {/* Project Selection */ }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                المشروع <span className="text-red-500">*</span>
              </label>
              { loadingProjects ? (
                <div className="px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-500">
                  جاري تحميل المشاريع...
                </div>
              ) : (
                <select
                  name="project_proposal_id"
                  value={ formData.project_proposal_id }
                  onChange={ handleChange }
                  className={ `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.project_proposal_id ? 'border-red-500' : 'border-gray-300'
                    }` }
                >
                  <option value="">اختر المشروع</option>
                  { projects.map((project) => (
                    <option key={ project.id } value={ project.id }>
                      { project.serial_number } - { project.project_name } ({ project.project_type })
                    </option>
                  )) }
                </select>
              ) }
              { errors.project_proposal_id && (
                <p className="mt-1 text-sm text-red-600">{ errors.project_proposal_id }</p>
              ) }

              {/* Project Information Display */ }
              { selectedProject && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-gray-800 mb-3 text-lg">معلومات المشروع المحدد:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">الكود التسلسلي</p>
                      <p className="font-semibold text-gray-900">{ selectedProject.serial_number }</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">اسم المشروع</p>
                      <p className="font-semibold text-gray-900">{ selectedProject.project_name }</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">المتبرع</p>
                      <p className="font-semibold text-gray-900">{ selectedProject.donor_name }</p>
                    </div>
                    { selectedProject.donor_code && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">كود المتبرع</p>
                        <p className="font-semibold text-gray-900">{ selectedProject.donor_code }</p>
                      </div>
                    ) }
                    { selectedProject.internal_code && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">الكود الداخلي</p>
                        <p className="font-semibold text-gray-900">{ selectedProject.internal_code }</p>
                      </div>
                    ) }
                    <div>
                      <p className="text-sm text-gray-500 mb-1">نوع المشروع</p>
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium">
                        { selectedProject.project_type }
                      </span>
                    </div>
                    { selectedProject.producer_name && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">ممنتج</p>
                        <p className="font-semibold text-gray-900">{ selectedProject.producer_name }</p>
                      </div>
                    ) }
                    { selectedProject.execution_date && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">تاريخ التنفيذ</p>
                        <p className="font-semibold text-gray-900">
                          { new Date(selectedProject.execution_date).toLocaleDateString('ar-SA', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          }) }
                        </p>
                      </div>
                    ) }
                  </div>
                </div>
              ) }
            </div>

            {/* Archive Type */ }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                نوع الأرشيف <span className="text-red-500">*</span>
              </label>
              <select
                name="archive_type"
                value={ formData.archive_type }
                onChange={ handleChange }
                className={ `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.archive_type ? 'border-red-500' : 'border-gray-300'
                  }` }
              >
                <option value="">اختر نوع الأرشيف</option>
                <option value="before_montage">قبل المونتاج (المواد الخام)</option>
                <option value="after_montage">بعد المونتاج (المواد المنجزة)</option>
              </select>
              { errors.archive_type && (
                <p className="mt-1 text-sm text-red-600">{ errors.archive_type }</p>
              ) }
              <p className="mt-1 text-sm text-gray-500">
                اختر نوع الأرشيف: قبل المونتاج للمواد الخام، أو بعد المونتاج للمواد المنجزة
              </p>
            </div>

            {/* Local Path */ }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                مسار الملفات على الهارد المحلي <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="local_path"
                value={ formData.local_path }
                onChange={ handleChange }
                placeholder="مثال: D:\Projects\Project_1001\Raw_Materials\"
                className={ `w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm ${errors.local_path ? 'border-red-500' : 'border-gray-300'
                  }` }
              />
              { errors.local_path && (
                <p className="mt-1 text-sm text-red-600">{ errors.local_path }</p>
              ) }
              <p className="mt-1 text-sm text-gray-500">
                أدخل المسار الكامل للملفات على الهارد المحلي
              </p>
            </div>

            {/* Notes */ }
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ملاحظات (اختياري)
              </label>
              <textarea
                name="notes"
                value={ formData.notes }
                onChange={ handleChange }
                rows={ 4 }
                placeholder="أضف أي ملاحظات إضافية..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Form Actions */ }
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={ loading }
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                { loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    <span>جاري الحفظ...</span>
                  </>
                ) : (
                  <>
                    <span>إضافة الأرشيف</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                ) }
              </button>
              <button
                type="button"
                onClick={ () => navigate('/media-management/archives') }
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default NewArchive;

