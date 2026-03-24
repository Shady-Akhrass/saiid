import React from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Heart,
  Package,
  Stethoscope,
  Home,
  ArrowLeft,
  TrendingUp
} from 'lucide-react';

const StatisticsIndex = () => {
  const statisticsLinks = [
    {
      route: '/statistics/orphans-statistics',
      name: 'orphansStatistics',
      label: 'احصائيات الأيتام',
      icon: <Heart className="w-8 h-8" />,
      color: 'from-purple-500 to-purple-600',
      bgColor: 'from-purple-100 to-purple-200',
      description: 'عرض إحصائيات شاملة عن الأيتام المسجلين في النظام'
    },
    {
      route: '/statistics/aids-statistics',
      name: 'aidsStatistics',
      label: 'احصائيات المساعدات',
      icon: <Package className="w-8 h-8" />,
      color: 'from-green-500 to-green-600',
      bgColor: 'from-green-100 to-green-200',
      description: 'عرض إحصائيات المساعدات المقدمة للمستفيدين'
    },
    {
      route: '/statistics/patient-statistics',
      name: 'patientStatistics',
      label: 'احصائيات المرضى',
      icon: <Stethoscope className="w-8 h-8" />,
      color: 'from-red-500 to-red-600',
      bgColor: 'from-red-100 to-red-200',
      description: 'عرض إحصائيات المرضى والخدمات الطبية المقدمة'
    },
    {
      route: '/statistics/shelter-statistics',
      name: 'shelterStatistics',
      label: 'احصائيات المخيمات',
      icon: <Home className="w-8 h-8" />,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'from-blue-100 to-blue-200',
      description: 'عرض إحصائيات مراكز النزوح والمخيمات'
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
      {/* Animated Background Elements */ }
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-40 right-40 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-7xl mx-auto">
        {/* Header */ }
        <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-4 bg-gradient-to-br from-sky-400 to-sky-500 rounded-2xl shadow-lg shadow-sky-200">
              <BarChart3 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                لوحة الإحصائيات
              </h1>
              <p className="text-gray-600 mt-1">اختر نوع الإحصائيات التي تريد عرضها</p>
            </div>
          </div>
        </div>

        {/* Statistics Cards Grid */ }
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          { statisticsLinks.map((stat) => (
            <Link
              key={ stat.name }
              to={ stat.route }
              className="group relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/20 p-6 hover:shadow-2xl transition-all duration-300 transform hover:scale-105 overflow-hidden"
            >
              {/* Background Gradient */ }
              <div className={ `absolute inset-0 bg-gradient-to-br ${stat.bgColor} opacity-0 group-hover:opacity-100 transition-opacity duration-300` }></div>

              {/* Content */ }
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-4">
                  <div className={ `p-4 bg-gradient-to-br ${stat.color} rounded-2xl shadow-lg transform group-hover:scale-110 transition-transform duration-300` }>
                    { stat.icon }
                  </div>
                  <TrendingUp className="w-6 h-6 text-gray-400 group-hover:text-gray-600 transition-colors duration-300" />
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-gray-900 transition-colors duration-300">
                  { stat.label }
                </h3>

                <p className="text-gray-600 text-sm mb-4 group-hover:text-gray-700 transition-colors duration-300">
                  { stat.description }
                </p>

                <div className="flex items-center text-sm font-medium text-sky-600 group-hover:text-sky-700 transition-colors duration-300">
                  <span>عرض الإحصائيات</span>
                  <ArrowLeft className="w-4 h-4 mr-2 transform group-hover:-translate-x-1 transition-transform duration-300" />
                </div>
              </div>

              {/* Hover Effect Border */ }
              <div className={ `absolute inset-0 rounded-3xl border-2 border-transparent group-hover:border-sky-300 transition-all duration-300` }></div>
            </Link>
          )) }
        </div>

        {/* Info Section */ }
        <div className="mt-8 bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-gradient-to-br from-amber-100 to-amber-200 rounded-xl">
              <TrendingUp className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">معلومات عن الإحصائيات</h3>
              <p className="text-gray-600 text-sm">
                يمكنك الوصول إلى جميع أنواع الإحصائيات من هذه الصفحة. كل قسم يحتوي على بيانات مفصلة ورسوم بيانية تفاعلية تساعدك على فهم الأداء والاتجاهات بشكل أفضل.
              </p>
            </div>
          </div>
        </div>
      </div>

      <style>{ `
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default StatisticsIndex;
