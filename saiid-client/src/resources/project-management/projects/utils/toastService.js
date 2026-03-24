import { toast } from 'react-toastify';

/**
 * Toast notification service for project management
 */

export const showToast = {
  success: (message) => {
    toast.success(message, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },

  error: (message) => {
    toast.error(message, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },

  warning: (message) => {
    toast.warning(message, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },

  info: (message) => {
    toast.info(message, {
      position: 'top-right',
      autoClose: 5000,
      hideProgressBar: false,
      closeOnClick: true,
      pauseOnHover: true,
      draggable: true,
    });
  },

  // Project-specific toast messages
  projectStatusChanged: (oldStatus, newStatus) => {
    toast.success(`تم تغيير الحالة من '${oldStatus}' إلى '${newStatus}'`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  projectCreated: (projectName) => {
    toast.success(`تم إنشاء المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  projectUpdated: (projectName) => {
    toast.success(`تم تحديث المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  projectDeleted: (projectName) => {
    toast.success(`تم حذف المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  projectPostponed: (projectName) => {
    toast.success(`تم تأجيل المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  projectResumed: (projectName) => {
    toast.success(`تم استئناف المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  supplyUpdated: (projectName) => {
    toast.success(`تم تحديث توريد المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  beneficiariesUpdated: (projectName) => {
    toast.success(`تم تحديث عدد المستفيدين للمشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  teamAssigned: (projectName) => {
    toast.success(`تم تعيين الفريق للمشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  shelterAssigned: (projectName) => {
    toast.success(`تم اختيار المخيم للمشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  executionStarted: (projectName) => {
    toast.success(`تم بدء تنفيذ المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  mediaAccepted: (projectName) => {
    toast.success(`تم قبول المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  mediaRejected: (projectName) => {
    toast.success(`تم رفض المشروع "${projectName}" بنجاح`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },

  error: (message, error) => {
    console.error('Error:', error);
    toast.error(`${message}: ${error.message || 'حدث خطأ غير معروف'}`, {
      position: 'top-right',
      autoClose: 5000,
    });
  },
};
