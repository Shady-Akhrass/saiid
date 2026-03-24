import React from 'react';
import FormAvailabilityAdmin from './FormAvailabilityAdmin';

const FormControlPanel = () => {
    return <FormAvailabilityAdmin />;
};

//     const forms = [
//         {
//             name: 'orphan',
//             title: 'كفالة اليتيم',
//             subtitle: 'نموذج تسجيل الأيتام',
//             icon: Users,
//             gradient: 'from-sky-400 via-sky-500 to-blue-500',
//             bgGradient: 'from-sky-50 to-blue-50',
//             shadowColor: 'shadow-sky-500/50',
//             ringColor: 'ring-sky-400',
//             iconBg: 'bg-sky-100',
//             iconColor: 'text-sky-600',
//             stats: '156 طلب هذا الشهر'
//         },
//         {
//             name: 'aid',
//             title: 'طلب المساعدة',
//             subtitle: 'نموذج المساعدات المالية',
//             icon: Heart,
//             gradient: 'from-rose-400 via-pink-500 to-rose-500',
//             bgGradient: 'from-rose-50 to-pink-50',
//             shadowColor: 'shadow-rose-500/50',
//             ringColor: 'ring-rose-400',
//             iconBg: 'bg-rose-100',
//             iconColor: 'text-rose-600',
//             stats: '243 طلب هذا الشهر'
//         },
//         {
//             name: 'patient',
//             title: 'المرضى',
//             subtitle: 'نموذج الرعاية الصحية',
//             icon: Stethoscope,
//             gradient: 'from-emerald-400 via-green-500 to-emerald-500',
//             bgGradient: 'from-emerald-50 to-green-50',
//             shadowColor: 'shadow-emerald-500/50',
//             ringColor: 'ring-emerald-400',
//             iconBg: 'bg-emerald-100',
//             iconColor: 'text-emerald-600',
//             stats: '89 طلب هذا الشهر'
//         },
//         {
//             name: 'shelter',
//             title: 'الإيواء',
//             subtitle: 'نموذج طلبات السكن',
//             icon: Home,
//             gradient: 'from-amber-400 via-orange-500 to-amber-500',
//             bgGradient: 'from-amber-50 to-orange-50',
//             shadowColor: 'shadow-amber-500/50',
//             ringColor: 'ring-amber-400',
//             iconBg: 'bg-amber-100',
//             iconColor: 'text-amber-600',
//             stats: '67 طلب هذا الشهر'
//         }
//     ];

//     const handleToggle = (formName) => {
//         const newStatus = !formsAvailability[formName];
//         toggleFormAvailability(formName, newStatus);

//         const formTitle = forms.find(f => f.name === formName)?.title;

//         setToast({
//             message: newStatus
//                 ? `✓ تم فتح نموذج ${formTitle} بنجاح!`
//                 : `✗ تم إغلاق نموذج ${formTitle}`,
//             type: newStatus ? "success" : "info",
//             isVisible: true,
//         });
//     };

//     const handleToggleAll = (status) => {
//         toggleAllForms(status);
//         setToast({
//             message: status
//                 ? "✓ تم فتح جميع النماذج بنجاح!"
//                 : "✗ تم إغلاق جميع النماذج",
//             type: status ? "success" : "info",
//             isVisible: true,
//         });
//     };

//     const handleSaveMessage = (formName, message) => {
//         setCustomMessages(prev => ({ ...prev, [formName]: message }));
//         localStorage.setItem(`${formName}FormClosedMessage`, message);
//         setEditingMessage(null);
//         setToast({
//             message: "تم حفظ الرسالة المخصصة بنجاح",
//             type: "success",
//             isVisible: true,
//         });
//     };

//     const openCount = Object.values(formsAvailability).filter(v => v === true).length;
//     const closedCount = forms.length - openCount;
//     const availabilityPercentage = (openCount / forms.length) * 100;

//     return (
//         <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 px-4 sm:px-6 lg:px-8 py-8" dir="rtl">
//             {/* Animated Background */}
//             <div className="fixed inset-0 overflow-hidden pointer-events-none">
//                 <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-200/40 to-blue-200/40 rounded-full blur-3xl animate-pulse-slow"></div>
//                 <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-200/40 to-purple-200/40 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
//                 <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-br from-pink-200/30 to-rose-200/30 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
//             </div>

//             <div className="relative max-w-7xl mx-auto">
//                 {/* Header Section */}
//                 <div className="mb-8">
//                     <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/60 p-8 transform hover:scale-[1.01] transition-all duration-500">
//                         <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
//                             <div className="flex items-start gap-4">
//                                 <div className="relative group">
//                                     <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-blue-500 rounded-2xl blur-lg opacity-75 group-hover:opacity-100 transition-opacity"></div>
//                                     <div className="relative p-4 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl shadow-lg">
//                                         <Settings className="w-8 h-8 text-white animate-spin-slow" />
//                                     </div>
//                                 </div>
//                                 <div>
//                                     <h1 className="text-4xl font-bold mb-2">
//                                         <span className="bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 bg-clip-text text-transparent">
//                                             لوحة التحكم
//                                         </span>
//                                     </h1>
//                                     <p className="text-gray-600 flex items-center gap-2">
//                                         <Activity className="w-4 h-4" />
//                                         إدارة شاملة لجميع النماذج الإلكترونية
//                                     </p>
//                                 </div>
//                             </div>

//                             <div className="flex gap-3">
//                                 <button
//                                     onClick={() => handleToggleAll(true)}
//                                     disabled={openCount === forms.length}
//                                     className={`group relative px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 overflow-hidden
//                     ${openCount === forms.length
//                                             ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
//                                             : 'bg-gradient-to-r from-emerald-500 to-green-500 text-white hover:shadow-2xl hover:shadow-emerald-500/50 transform hover:scale-105 active:scale-95'
//                                         }`}
//                                 >
//                                     <div className="relative flex items-center gap-2 z-10">
//                                         <CheckCircle className="w-5 h-5" />
//                                         <span>فتح الكل</span>
//                                     </div>
//                                     {openCount !== forms.length && (
//                                         <div className="absolute inset-0 bg-gradient-to-r from-green-400 to-emerald-400 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
//                                     )}
//                                 </button>

//                                 <button
//                                     onClick={() => handleToggleAll(false)}
//                                     disabled={closedCount === forms.length}
//                                     className={`group relative px-6 py-3.5 rounded-2xl font-bold transition-all duration-300 overflow-hidden
//                     ${closedCount === forms.length
//                                             ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
//                                             : 'bg-gradient-to-r from-red-500 to-rose-500 text-white hover:shadow-2xl hover:shadow-red-500/50 transform hover:scale-105 active:scale-95'
//                                         }`}
//                                 >
//                                     <div className="relative flex items-center gap-2 z-10">
//                                         <AlertCircle className="w-5 h-5" />
//                                         <span>إغلاق الكل</span>
//                                     </div>
//                                     {closedCount !== forms.length && (
//                                         <div className="absolute inset-0 bg-gradient-to-r from-rose-400 to-red-400 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left"></div>
//                                     )}
//                                 </button>
//                             </div>
//                         </div>
//                     </div>
//                 </div>

//                 {/* Stats Dashboard */}
//                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
//                     <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-6 transform hover:scale-105 transition-all duration-300">
//                         <div className="flex items-center justify-between mb-4">
//                             <div className="p-3 bg-gradient-to-br from-emerald-100 to-green-100 rounded-2xl">
//                                 <CheckCircle className="w-6 h-6 text-emerald-600" />
//                             </div>
//                             <span className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-green-600 bg-clip-text text-transparent">
//                                 {openCount}
//                             </span>
//                         </div>
//                         <h3 className="text-gray-600 font-medium">نماذج مفتوحة</h3>
//                         <div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
//                             <TrendingUp className="w-4 h-4" />
//                             <span>متاحة للاستخدام</span>
//                         </div>
//                     </div>

//                     <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-6 transform hover:scale-105 transition-all duration-300">
//                         <div className="flex items-center justify-between mb-4">
//                             <div className="p-3 bg-gradient-to-br from-red-100 to-rose-100 rounded-2xl">
//                                 <AlertCircle className="w-6 h-6 text-red-600" />
//                             </div>
//                             <span className="text-3xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
//                                 {closedCount}
//                             </span>
//                         </div>
//                         <h3 className="text-gray-600 font-medium">نماذج مغلقة</h3>
//                         <div className="mt-3 flex items-center gap-2 text-sm text-red-600">
//                             <Clock className="w-4 h-4" />
//                             <span>غير متاحة حالياً</span>
//                         </div>
//                     </div>

//                     <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 p-6 transform hover:scale-105 transition-all duration-300">
//                         <div className="flex items-center justify-between mb-4">
//                             <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-2xl">
//                                 <Activity className="w-6 h-6 text-blue-600" />
//                             </div>
//                             <span className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
//                                 {availabilityPercentage.toFixed(0)}%
//                             </span>
//                         </div>
//                         <h3 className="text-gray-600 font-medium">نسبة التوفر</h3>
//                         <div className="mt-3 w-full bg-gray-200 rounded-full h-2 overflow-hidden">
//                             <div
//                                 className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-1000"
//                                 style={{ width: `${availabilityPercentage}%` }}
//                             ></div>
//                         </div>
//                     </div>
//                 </div>

//                 {/* Forms Grid */}
//                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
//                     {forms.map((form, index) => {
//                         const isAvailable = formsAvailability[form.name];
//                         const Icon = form.icon;

//                         return (
//                             <div
//                                 key={form.name}
//                                 className="group bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-white/60 overflow-hidden transform hover:scale-[1.02] transition-all duration-500 hover:shadow-2xl"
//                                 style={{ animationDelay: `${index * 100}ms` }}
//                             >
//                                 {/* Card Header with Gradient */}
//                                 <div className={`relative h-40 bg-gradient-to-br ${form.gradient} overflow-hidden`}>
//                                     {/* Animated Background Pattern */}
//                                     <div className="absolute inset-0 opacity-20">
//                                         <div className="absolute inset-0" style={{
//                                             backgroundImage: 'radial-gradient(circle at 20px 20px, white 2px, transparent 0)',
//                                             backgroundSize: '40px 40px'
//                                         }}></div>
//                                     </div>

//                                     {/* Floating Icon */}
//                                     <div className="absolute top-6 right-6">
//                                         <div className="relative">
//                                             <div className="absolute inset-0 bg-white/30 rounded-3xl blur-xl animate-pulse"></div>
//                                             <div className="relative p-4 bg-white/20 backdrop-blur-md rounded-3xl border border-white/30 transform group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
//                                                 <Icon className="w-10 h-10 text-white drop-shadow-lg" />
//                                             </div>
//                                         </div>
//                                     </div>

//                                     {/* Title */}
//                                     <div className="absolute bottom-6 right-6 left-6">
//                                         <h3 className="text-2xl font-bold text-white mb-1 drop-shadow-lg">
//                                             {form.title}
//                                         </h3>
//                                         <p className="text-white/90 text-sm font-medium drop-shadow">
//                                             {form.subtitle}
//                                         </p>
//                                     </div>

//                                     {/* Status Badge */}
//                                     <div className="absolute top-6 left-6">
//                                         <div className={`flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md border
//                       ${isAvailable
//                                                 ? 'bg-emerald-500/90 border-emerald-300/50'
//                                                 : 'bg-red-500/90 border-red-300/50'
//                                             }`}
//                                         >
//                                             <div className={`w-2 h-2 rounded-full ${isAvailable ? 'bg-white animate-pulse' : 'bg-white/70'}`}></div>
//                                             <span className="text-white text-sm font-bold">
//                                                 {isAvailable ? 'نشط' : 'معطل'}
//                                             </span>
//                                         </div>
//                                     </div>
//                                 </div>

//                                 {/* Card Body */}
//                                 <div className="p-6">
//                                     {/* Stats */}
//                                     <div className={`mb-6 p-4 rounded-2xl bg-gradient-to-r ${form.bgGradient} border border-white/50`}>
//                                         <div className="flex items-center gap-3">
//                                             <TrendingUp className={`w-5 h-5 ${form.iconColor}`} />
//                                             <span className={`font-medium ${form.iconColor}`}>
//                                                 {form.stats}
//                                             </span>
//                                         </div>
//                                     </div>

//                                     {/* Toggle Button */}
//                                     <button
//                                         onClick={() => handleToggle(form.name)}
//                                         className={`w-full group/toggle relative mb-4 px-6 py-4 rounded-2xl font-bold transition-all duration-300 overflow-hidden
//                       ${isAvailable
//                                                 ? `bg-gradient-to-r ${form.gradient} text-white shadow-lg ${form.shadowColor} hover:shadow-2xl`
//                                                 : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg shadow-gray-500/50 hover:shadow-2xl'
//                                             } transform hover:scale-105 active:scale-95`}
//                                     >
//                                         <div className="relative flex items-center justify-center gap-3 z-10">
//                                             {isAvailable ? (
//                                                 <>
//                                                     <ToggleRight className="w-6 h-6" />
//                                                     <span>النموذج مفتوح - اضغط للإغلاق</span>
//                                                 </>
//                                             ) : (
//                                                 <>
//                                                     <ToggleLeft className="w-6 h-6" />
//                                                     <span>النموذج مغلق - اضغط للفتح</span>
//                                                 </>
//                                             )}
//                                         </div>
//                                         <div className="absolute inset-0 bg-white/20 transform scale-x-0 group-hover/toggle:scale-x-100 transition-transform origin-right"></div>
//                                     </button>

//                                     {/* Custom Message Section */}
//                                     <div className="space-y-3">
//                                         <div className="flex items-center justify-between">
//                                             <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
//                                                 <Info className="w-4 h-4" />
//                                                 رسالة الإغلاق المخصصة
//                                             </label>
//                                             <button
//                                                 onClick={() => setEditingMessage(editingMessage === form.name ? null : form.name)}
//                                                 className={`p-2 rounded-xl transition-all duration-300 ${editingMessage === form.name
//                                                         ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg'
//                                                         : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
//                                                     }`}
//                                             >
//                                                 <Edit3 className="w-4 h-4" />
//                                             </button>
//                                         </div>

//                                         {editingMessage === form.name ? (
//                                             <div className="space-y-3">
//                                                 <textarea
//                                                     value={customMessages[form.name]}
//                                                     onChange={(e) => setCustomMessages(prev => ({ ...prev, [form.name]: e.target.value }))}
//                                                     className="w-full px-4 py-3 border-2 border-gray-200 rounded-2xl focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all duration-300 resize-none"
//                                                     rows="3"
//                                                     placeholder="أدخل رسالة مخصصة..."
//                                                 />
//                                                 <div className="flex gap-2">
//                                                     <button
//                                                         onClick={() => handleSaveMessage(form.name, customMessages[form.name])}
//                                                         className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-green-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-emerald-500/50 transform hover:scale-105 transition-all duration-300"
//                                                     >
//                                                         حفظ
//                                                     </button>
//                                                     <button
//                                                         onClick={() => setEditingMessage(null)}
//                                                         className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-xl font-medium hover:bg-gray-300 transform hover:scale-105 transition-all duration-300"
//                                                     >
//                                                         إلغاء
//                                                     </button>
//                                                 </div>
//                                             </div>
//                                         ) : (
//                                             <div className={`p-4 rounded-2xl bg-gradient-to-r ${form.bgGradient} border border-white/50`}>
//                                                 <p className="text-sm text-gray-700 leading-relaxed">
//                                                     {customMessages[form.name]}
//                                                 </p>
//                                             </div>
//                                         )}
//                                     </div>

//                                     {/* Status Info */}
//                                     <div className={`mt-4 p-4 rounded-2xl border-2 ${isAvailable
//                                             ? 'bg-emerald-50 border-emerald-200'
//                                             : 'bg-red-50 border-red-200'
//                                         }`}>
//                                         <div className="flex items-start gap-3">
//                                             {isAvailable ? (
//                                                 <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
//                                             ) : (
//                                                 <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
//                                             )}
//                                             <p className={`text-sm font-medium ${isAvailable ? 'text-emerald-700' : 'text-red-700'
//                                                 }`}>
//                                                 {isAvailable
//                                                     ? 'المستخدمون يمكنهم تقديم طلبات جديدة الآن'
//                                                     : 'لا يمكن للمستخدمين تقديم طلبات جديدة حالياً'
//                                                 }
//                                             </p>
//                                         </div>
//                                     </div>
//                                 </div>
//                             </div>
//                         );
//                     })}
//                 </div>
//             </div>

//             {/* Toast Notification */}
//             {toast.isVisible && (
//                 <Toast
//                     message={toast.message}
//                     type={toast.type}
//                     onClose={() => setToast({ ...toast, isVisible: false })}
//                 />
//             )}

//             <style jsx>{`
//         @keyframes pulse-slow {
//           0%, 100% {
//             opacity: 0.3;
//             transform: scale(1);
//           }
//           50% {
//             opacity: 0.5;
//             transform: scale(1.05);
//           }
//         }

//         @keyframes spin-slow {
//           from {
//             transform: rotate(0deg);
//           }
//           to {
//             transform: rotate(360deg);
//           }
//         }

//         .animate-pulse-slow {
//           animation: pulse-slow 4s ease-in-out infinite;
//         }

//         .animate-spin-slow {
//           animation: spin-slow 8s linear infinite;
//         }

//         @media (prefers-reduced-motion: reduce) {
//           .animate-pulse-slow,
//           .animate-spin-slow {
//             animation: none;
//           }
//         }
//       `}</style>
//         </div>
//     );
// };

export default FormControlPanel;