import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Heart, AlertCircle, MapPin, Home, Phone, Users, BookOpen, FileText, Briefcase, ChevronDown, UserCheck, Baby, Download, Eye } from 'lucide-react';
import apiClient from '../../../utils/axiosConfig';

// ✅ بناء API_BASE بشكل صحيح
const getApiBase = () => {
  const base = import.meta.env.VITE_API_URL || "https://forms-api.saiid.org/api";
  // ✅ إزالة /api من النهاية إذا كان موجوداً
  const apiBase = base.replace(/\/api$/, '');
  return apiBase;
};

const API_BASE = getApiBase();

const OrphanDetailsModal = ({ isOpen, onClose, orphan, formatDate, calculateAge }) => {
  const [expandedSections, setExpandedSections] = useState({
    personal: true,
    guardian: false,
    father: false,
    mother: false,
  });
  const [showMotherCertificateModal, setShowMotherCertificateModal] = useState(false);
  const [motherCertificateError, setMotherCertificateError] = useState(false);
  const [motherCertificateModalError, setMotherCertificateModalError] = useState(false);

  // Reset error states when orphan changes
  useEffect(() => {
    setMotherCertificateError(false);
    setMotherCertificateModalError(false);
    setShowMotherCertificateModal(false);
  }, [orphan?.orphan_id_number]);

  if (!orphan) return null;

  // Download mother death certificate
  const handleDownloadMotherCertificate = async () => {
    try {
      // ✅ استخدام apiClient بدلاً من fetch
      const response = await apiClient.get(`/mother-death-certificate/${orphan.orphan_id_number}`, {
        responseType: 'blob',
        skipDeduplication: true, // ✅ اختياري للصور
      });

      if (response.data && response.data.type && response.data.type.startsWith('image/')) {
        const url = window.URL.createObjectURL(response.data);
        const link = document.createElement('a');
        link.href = url;
        link.download = `شهادة_وفاة_الأم_${orphan.orphan_id_number}.jpg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      } else {
        throw new Error('Invalid image type');
      }
    } catch (error) {
      console.error('Error downloading certificate:', error);
      alert('حدث خطأ أثناء تحميل شهادة الوفاة');
    }
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const expandAll = () => {
    const allExpanded = {};
    Object.keys(expandedSections).forEach(key => {
      allExpanded[key] = true;
    });
    setExpandedSections(allExpanded);
  };

  const collapseAll = () => {
    const allCollapsed = {};
    Object.keys(expandedSections).forEach(key => {
      allCollapsed[key] = false;
    });
    setExpandedSections(allCollapsed);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300 ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      <div
        className={`relative bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl max-w-5xl w-full max-h-[80vh] overflow-hidden transform transition-all duration-300 ${
          isOpen ? "scale-100 translate-y-0" : "scale-95 translate-y-10"
        }`}
      >
        {/* Header */}
        <div className="relative bg-gradient-to-br from-sky-400 via-sky-300 to-orange-200 p-4">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/20 rounded-full blur-xl"></div>
          <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-300/20 rounded-full blur-xl"></div>

          <button
            onClick={onClose}
            className="absolute top-3 left-3 p-2 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all duration-300 group z-10"
          >
            <X className="w-5 h-5 text-white group-hover:rotate-90 transition-transform duration-300" />
          </button>

          <div className="flex items-center gap-4">
            <div className="relative cursor-pointer group">
              <div className="absolute inset-0 bg-white/30 rounded-2xl blur-lg"></div>
              <img
                src={`${API_BASE}/image/${orphan.orphan_id_number}`}
                alt="صورة اليتيم"
                className="relative h-20 w-20 object-cover rounded-2xl border-3 border-white shadow-xl transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div className="text-white flex-1">
              <h1 className="text-xl font-bold mb-1">
                {orphan.orphan_full_name}
              </h1>
             
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors font-medium"
            >
              توسيع الكل
            </button>
            <button
              onClick={collapseAll}
              className="text-xs px-3 py-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              طي الكل
            </button>
          </div>
          <div className="text-xs text-gray-500">
            انقر على القسم لعرض التفاصيل
          </div>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 220px)' }}>
          <div className="space-y-3">
            
            {/* Personal Information Section */}
            <CollapsibleSection
              title="المعلومات الشخصية"
              icon={User}
              color="sky"
              isExpanded={expandedSections.personal}
              onToggle={() => toggleSection('personal')}
              summary={`${orphan.orphan_gender || ''} • ${orphan.orphan_birth_date ? formatDate(orphan.orphan_birth_date) : ''}`}
            >
              <div className="space-y-6">
                {/* Basic Info - 3 Column Grid */}
                <div>
                  <h4 className="text-xs font-bold text-sky-700 mb-3 flex items-center gap-2 pb-2 border-b border-sky-200">
                    <User className="w-4 h-4" />
                    البيانات الأساسية
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InfoRow label="الاسم الكامل" value={orphan.orphan_full_name} icon={User} />
                    <InfoRow label="رقم الهوية" value={orphan.orphan_id_number} icon={FileText}  />
                    <InfoRow label="الجنس" value={orphan.orphan_gender} icon={User} />
                    <InfoRow label="تاريخ الميلاد" value={formatDate(orphan.orphan_birth_date)} icon={Calendar} />
                    <InfoRow label="العمر" value={orphan.orphan_birth_date ? `${calculateAge(orphan.orphan_birth_date)} سنة` : null} icon={Calendar} />
                  </div>
                </div>

                {/* Health Status - 3 Column Grid */}
                <div>
                  <h4 className="text-xs font-bold text-sky-700 mb-3 flex items-center gap-2 pb-2 border-b border-emerald-200">
                    <Heart className="w-4 h-4" />
                    الحالة الصحية
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="flex items-start gap-2 col-span-1">
                      <Heart className="w-4 h-4 text-gray-600 mt-1 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-500 mb-1">الوضع الصحي</p>
                        <div
                          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                            orphan.health_status === "جيدة"
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {orphan.health_status || '-'}
                        </div>
                      </div>
                    </div>
                    {orphan.disease_description && (
                      <div className="col-span-1 md:col-span-2">
                        <InfoRow label="وصف المرض" value={orphan.disease_description} icon={FileText} fullWidth />
                      </div>
                    )}
                  </div>
                </div>

                {/* Address Information - 3 Column Grid */}
                <div>
                  <h4 className="text-xs font-bold text-sky-700 mb-3 flex items-center gap-2 pb-2 border-b border-purple-200">
                    <MapPin className="w-4 h-4" />
                    معلومات العنوان
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InfoRow label="العنوان الأصلي" value={orphan.original_address} icon={Home} />
                    <InfoRow label="العنوان الحالي" value={orphan.current_address} icon={Home} />
                    {orphan.address_details && (
                      <div className="col-span-1 md:col-span-3">
                        <InfoRow label="تفاصيل العنوان" value={orphan.address_details} icon={MapPin} fullWidth />
                      </div>
                    )}
                  </div>
                </div>

                {/* Family Information - 3 Column Grid */}
                <div>
                  <h4 className="text-xs font-bold text-sky-700 mb-3 flex items-center gap-2 pb-2 border-b border-pink-200">
                    <Users className="w-4 h-4" />
                    معلومات العائلة
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <InfoRow label="عدد الإخوة" value={orphan.number_of_brothers || '0'} icon={Users} />
                    <InfoRow label="عدد الأخوات" value={orphan.number_of_sisters || '0'} icon={Users} />
                    <InfoRow 
                      label="ملتحق بمركز تحفيظ" 
                      value={
                        orphan.is_enrolled_in_memorization_center === 'yes' 
                          ? 'نعم' 
                          : orphan.is_enrolled_in_memorization_center === 'no' 
                          ? 'لا' 
                          : null
                      } 
                      icon={BookOpen} 
                    />
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            {/* Guardian Information Section */}
            {orphan.guardian_full_name && (
              <CollapsibleSection
                title="معلومات ولي الأمر"
                icon={UserCheck}
                color="green"
                isExpanded={expandedSections.guardian}
                onToggle={() => toggleSection('guardian')}
                summary={`${orphan.guardian_full_name} • ${orphan.guardian_relationship || ''}`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <InfoItem label="الاسم الكامل" value={orphan.guardian_full_name} icon={User} fullWidth />
                  </div>
                  <InfoItem label="رقم الهوية" value={orphan.guardian_id_number} icon={FileText}  />
                  <InfoItem label="صلة القرابة" value={orphan.guardian_relationship} icon={Heart} />
                  <InfoItem label="رقم الهاتف" value={orphan.guardian_phone_number} icon={Phone}  />
                  {orphan.alternative_phone_number && (
                    <InfoItem label="رقم بديل" value={orphan.alternative_phone_number} icon={Phone}  />
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Father Information Section */}
            {orphan.deceased_father_full_name && (
              <CollapsibleSection
                title="معلومات الأب المتوفى"
                icon={User}
                color="blue"
                isExpanded={expandedSections.father}
                onToggle={() => toggleSection('father')}
                summary={`${orphan.deceased_father_full_name} • ${orphan.death_date ? formatDate(orphan.death_date) : ''}`}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <InfoItem label="الاسم الكامل" value={orphan.deceased_father_full_name} icon={User} fullWidth />
                    </div>
                    <InfoItem label="تاريخ الميلاد" value={formatDate(orphan.deceased_father_birth_date)} icon={Calendar} />
                    <InfoItem label="تاريخ الوفاة" value={formatDate(orphan.death_date)} icon={Calendar} />
                    <InfoItem label="سبب الوفاة" value={orphan.death_cause} icon={AlertCircle} />
                    <InfoItem label="المهنة السابقة" value={orphan.previous_father_job} icon={Briefcase} />
                  </div>
                  {orphan.death_certificate && (
                    <div className="flex items-center gap-2 text-blue-700">
                      <FileText className="w-5 h-5" />
                      <p className="text-sm font-medium">شهادة الوفاة: متوفرة</p>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Mother Information Section */}
            {orphan.mother_full_name && (
              <CollapsibleSection
                title="معلومات الأم"
                icon={Baby}
                color="rose"
                isExpanded={expandedSections.mother}
                onToggle={() => toggleSection('mother')}
                summary={`${orphan.mother_full_name} • ${(orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') ? 'متوفاة' : 'على قيد الحياة'}`}
                badge={(orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') ? 'متوفاة' : (orphan.is_mother_deceased === 'no' || orphan.is_mother_deceased === 'لا') ? 'على قيد الحياة' : null}
                badgeColor={(orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') ? 'gray' : 'green'}
              >
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <InfoItem label="الاسم الكامل" value={orphan.mother_full_name} icon={User} fullWidth />
                    </div>
                    <InfoItem label="رقم الهوية" value={orphan.mother_id_number} icon={FileText} dir="ltr" />
                    <InfoItem label="تاريخ الميلاد" value={formatDate(orphan.mother_birth_date)} icon={Calendar} />
                    {(orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') && orphan.mother_death_date && (
                      <InfoItem label="تاريخ الوفاة" value={formatDate(orphan.mother_death_date)} icon={Calendar} />
                    )}
                    {orphan.mother_status && (
                      <InfoItem label="الحالة الاجتماعية" value={orphan.mother_status} icon={Heart} />
                    )}
                    {orphan.mother_job && (
                      <InfoItem label="المهنة" value={orphan.mother_job} icon={Briefcase} />
                    )}
                  </div>
                  
                  {/* Mother Status Display */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-center gap-3 p-4 rounded-xl bg-gradient-to-r from-rose-50 to-pink-50 border-2 border-rose-200">
                      <AlertCircle className={`w-5 h-5 ${
                        (orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') 
                          ? 'text-gray-600' 
                          : 'text-green-600'
                      }`} />
                      <div className="text-center">
                        <p className="text-xs text-gray-600 mb-1">حالة الأم</p>
                        <p className={`text-lg font-bold ${
                          (orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') 
                            ? 'text-gray-700' 
                            : 'text-green-700'
                        }`}>
                          {(orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') 
                            ? 'متوفاة' 
                            : (orphan.is_mother_deceased === 'no' || orphan.is_mother_deceased === 'لا') 
                            ? 'على قيد الحياة' 
                            : 'غير محدد'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Mother Death Certificate */}
                  {(orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-rose-700 mb-3">
                      <FileText className="w-5 h-5" />
                          <p className="text-sm font-medium">شهادة وفاة الأم</p>
                        </div>
                        
                        <div className="relative group">
                          <div className="relative w-full h-48 bg-gray-100 rounded-lg border-2 border-rose-200 overflow-hidden">
                            {!motherCertificateError ? (
                              <img
                                src={`${API_BASE}/mother-death-certificate/${orphan.orphan_id_number}`}
                                alt="شهادة وفاة الأم"
                                className="w-full h-full object-contain cursor-pointer"
                                onError={() => setMotherCertificateError(true)}
                                onClick={() => {
                                  setMotherCertificateModalError(false);
                                  setShowMotherCertificateModal(true);
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                                <FileText className="w-12 h-12 mb-2" />
                                <p className="text-sm">شهادة الوفاة غير متوفرة</p>
                              </div>
                            )}
                            {!motherCertificateError && (
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-300 flex items-center justify-center pointer-events-none">
                                <Eye className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {!motherCertificateError && (
                            <button
                              onClick={() => {
                                setMotherCertificateModalError(false);
                                setShowMotherCertificateModal(true);
                              }}
                              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-lg hover:from-sky-500 hover:to-sky-600 transition-all duration-300 shadow-md hover:shadow-lg"
                            >
                              <Eye className="w-4 h-4" />
                              <span>عرض</span>
                            </button>
                          )}
                          <button
                            onClick={handleDownloadMotherCertificate}
                            disabled={motherCertificateError}
                            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 shadow-md hover:shadow-lg ${
                              motherCertificateError
                                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                : 'bg-gradient-to-r from-green-400 to-green-500 text-white hover:from-green-500 hover:to-green-600'
                            }`}
                          >
                            <Download className="w-4 h-4" />
                            <span>تحميل</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CollapsibleSection>
            )}

          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <div className="flex gap-3 justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-xl hover:from-sky-500 hover:to-sky-600 transition-all duration-300 font-medium shadow-lg shadow-sky-200 hover:scale-105"
            >
              إغلاق
            </button>
          </div>
        </div>
      </div>

      {/* Mother Death Certificate Modal */}
      {showMotherCertificateModal && (orphan.is_mother_deceased === 'yes' || orphan.is_mother_deceased === 'نعم') && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowMotherCertificateModal(false)}
        >
          <div className="relative max-w-5xl max-h-[90vh] w-full">
            <button
              onClick={() => setShowMotherCertificateModal(false)}
              className="absolute top-4 left-4 p-2 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all duration-300 z-10"
            >
              <X className="w-5 h-5 text-white" />
            </button>
            <div className="bg-white rounded-2xl p-4 shadow-2xl">
              <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">شهادة وفاة الأم</h3>
              {!motherCertificateModalError ? (
                <img
                  src={`${API_BASE}/mother-death-certificate/${orphan.orphan_id_number}`}
                  alt="شهادة وفاة الأم"
                  className="max-w-full max-h-[75vh] object-contain rounded-lg mx-auto"
                  onClick={(e) => e.stopPropagation()}
                  onError={() => setMotherCertificateModalError(true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <FileText className="w-16 h-16 mb-4" />
                  <p className="text-lg">شهادة الوفاة غير متوفرة</p>
                </div>
              )}
              <div className="flex justify-center gap-3 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownloadMotherCertificate();
                  }}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-lg hover:from-green-500 hover:to-green-600 transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection = ({ 
  title, 
  icon: Icon, 
  color, 
  isExpanded, 
  onToggle, 
  summary, 
  children,
  badge,
  badgeColor = "blue"
}) => {
  const colorClasses = {
    sky: {
      bg: 'bg-sky-50 hover:bg-sky-100',
      border: 'border-sky-200',
      text: 'text-sky-700',
      iconBg: 'bg-sky-100',
      icon: 'text-sky-600',
      expanded: 'bg-sky-100 border-sky-300',
    },
    green: {
      bg: 'bg-green-50 hover:bg-green-100',
      border: 'border-green-200',
      text: 'text-green-700',
      iconBg: 'bg-green-100',
      icon: 'text-green-600',
      expanded: 'bg-green-100 border-green-300',
    },
    blue: {
      bg: 'bg-blue-50 hover:bg-blue-100',
      border: 'border-blue-200',
      text: 'text-blue-700',
      iconBg: 'bg-blue-100',
      icon: 'text-blue-600',
      expanded: 'bg-blue-100 border-blue-300',
    },
    rose: {
      bg: 'bg-rose-50 hover:bg-rose-100',
      border: 'border-rose-200',
      text: 'text-rose-700',
      iconBg: 'bg-rose-100',
      icon: 'text-rose-600',
      expanded: 'bg-rose-100 border-rose-300',
    },
  };

  const badgeColorClasses = {
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    amber: 'bg-amber-100 text-amber-700 border-amber-300',
    gray: 'bg-gray-100 text-gray-700 border-gray-300',
    green: 'bg-green-100 text-green-700 border-green-300',
  };

  const colors = colorClasses[color] || colorClasses.sky;

  return (
    <div className={`rounded-xl border-2 transition-all duration-300 overflow-hidden ${
      isExpanded ? colors.expanded : `${colors.bg} ${colors.border}`
    }`}>
      <button
        onClick={onToggle}
        className="w-full p-3 flex items-center justify-between transition-all duration-300 hover:shadow-sm"
      >
        <div className="flex items-center gap-3 flex-1">
          <div className={`p-2 ${colors.iconBg} rounded-lg transition-transform duration-300 ${
            isExpanded ? 'scale-110' : ''
          }`}>
            <Icon className={`w-4 h-4 ${colors.icon}`} />
          </div>
          <div className="text-right flex-1">
            <h3 className={`text-sm font-bold ${colors.text} flex items-center gap-2`}>
              {title}
              {badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full border ${badgeColorClasses[badgeColor]}`}>
                  {badge}
                </span>
              )}
            </h3>
            {!isExpanded && summary && (
              <p className="text-xs text-gray-600 mt-0.5 truncate">{summary}</p>
            )}
          </div>
        </div>
        <div className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
          <ChevronDown className={`w-4 h-4 ${colors.icon}`} />
        </div>
      </button>

      <div className={`transition-all duration-300 overflow-hidden ${
        isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
      }`}>
        <div className="p-3 pt-0 border-t border-gray-200 mt-2">
          {children}
        </div>
      </div>
    </div>
  );
};

// Info Row Component (for 3-column grid in personal section) - No background
const InfoRow = ({ icon: Icon, label, value, dir = "rtl", fullWidth = false }) => {
  if (!value || value === 'غير محدد' || value === '-') {
    return null;
  }
  
  return (
    <div className={`${fullWidth ? 'col-span-full' : ''} flex items-start gap-2`}>
      {Icon && <Icon className="w-4 h-4 text-gray-600 mt-1 flex-shrink-0" />}
      <div className="min-w-0 flex-1">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className="text-sm font-medium text-gray-800 break-words" dir={dir}>
          {value}
        </p>
      </div>
    </div>
  );
};

// Info Item Component (for other sections - 2 columns)
const InfoItem = ({ icon: Icon, label, value, dir = "rtl", fullWidth = false }) => {
  if (!value || value === 'غير محدد' || value === '-') {
    return null;
  }
  
  return (
    <div className={`${fullWidth ? 'col-span-full' : ''}`}>
      <div className="flex items-start gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-600 mt-1 flex-shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-500 mb-0.5">{label}</p>
          <p className="text-sm font-medium text-gray-800 break-words" dir={dir}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrphanDetailsModal;