import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX, ArrowRight, Home } from 'lucide-react';

const Unauthorized = ({ requiredRole = 'admin', pageName = 'هذا القسم' }) => {
  const getRoleName = (role) => {
    const roles = {
      admin: 'مدير عام',
      project_manager: 'مدير مشاريع',
      media_manager: 'مدير إعلام',
      executed_projects_coordinator: 'منسق مشاريع منفذة',
    };
    return roles[role] || role;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center">
            <ShieldX className="w-12 h-12 text-red-600" />
          </div>
        </div>
        
        <h1 className="text-3xl font-bold text-gray-800 mb-4">
          ليس لديك صلاحيات
        </h1>
        
        <p className="text-lg text-gray-600 mb-2">
          ليس لديك صلاحيات للوصول إلى {pageName}
        </p>
        
        <p className="text-sm text-gray-500 mb-8">
          الصلاحية المطلوبة: <span className="font-semibold text-red-600">{getRoleName(requiredRole)}</span>
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/project-management/projects"
            className="inline-flex items-center justify-center px-6 py-3 bg-sky-500 hover:bg-sky-600 text-white rounded-xl font-medium transition-colors"
          >
            <ArrowRight className="w-5 h-5 ml-2" />
            العودة إلى المشاريع
          </Link>
          
          <Link
            to="/"
            className="inline-flex items-center justify-center px-6 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
          >
            <Home className="w-5 h-5 ml-2" />
            الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Unauthorized;

