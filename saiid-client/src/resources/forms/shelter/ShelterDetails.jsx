import React, { useState } from 'react';
import { Info, Edit, Home, User, Phone, MapPin, Users, FileText, Search } from 'lucide-react';
import EditShelterModal from '../../modals/EditShelterModal';

const API_BASE = import.meta.env.VITE_API_URL || "https://forms-api.saiid.org/api";

const ShelterDetails = ({ shelter, onEdit, onNewSearch, onUpdateSuccess }) => {
    const [showEditModal, setShowEditModal] = useState(false);
    const [localShelter, setLocalShelter] = useState(shelter);

    // Keep local shelter in sync with parent
    React.useEffect(() => {
        setLocalShelter(shelter);
    }, [shelter]);

    const handleEditClick = () => {
        setShowEditModal(true);
    };

    const handleUpdateSuccess = (updatedShelter) => {
        setLocalShelter(updatedShelter);
        setShowEditModal(false);
        if (onUpdateSuccess) {
            onUpdateSuccess(updatedShelter);
        }
    };

    // Data field component
    const DataField = ({ label, value, icon: Icon, highlight = false, dir = "rtl" }) => (
        <div className={`p-4 rounded-2xl transition-all duration-300 hover:bg-blue-50 ${highlight ? 'bg-blue-50' : 'bg-gray-50'}`}>
            <div className="flex items-center gap-2 mb-2">
                {Icon && <Icon className="w-4 h-4 text-gray-500" />}
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {label}
                </span>
            </div>
            <p className="font-semibold text-gray-900 text-lg" dir={dir}>
                {value || '—'}
            </p>
        </div>
    );

    return (
        <>
            <div className="bg-white rounded-3xl overflow-hidden shadow-lg animate-fadeIn">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-sky-500 via-blue-500 to-purple-600 p-8 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-4 bg-white/20 backdrop-blur-sm rounded-2xl">
                                <Home className="w-8 h-8" />
                            </div>
                            <div>
                                <h2 className="text-3xl font-bold mb-2">{localShelter.camp_name || 'مخيم'}</h2>
                                <p className="text-blue-100 text-sm">
                                    رقم هوية المدير: {localShelter.manager_id_number}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleEditClick}
                                className="p-3 bg-white/20 backdrop-blur-sm rounded-xl hover:bg-white/30 transition-all duration-300 group"
                                title="تعديل بيانات المخيم"
                            >
                                <Edit className="w-5 h-5 group-hover:scale-110 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Content Section */}
                <div className="p-8">
                    {/* Shelter Information */}
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <Home className="w-5 h-5 text-sky-500" />
                            معلومات المخيم
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DataField label="اسم المخيم" value={localShelter.camp_name} icon={Home} highlight />
                            <DataField label="المحافظة" value={localShelter.governorate} icon={MapPin} />
                            <DataField label="الحي" value={localShelter.district} icon={MapPin} />
                            <DataField label="العنوان التفصيلي" value={localShelter.detailed_address} icon={MapPin} />
                            <DataField label="عدد الخيام" value={localShelter.tents_count} icon={Home} />
                            <DataField label="عدد العائلات" value={localShelter.families_count} icon={Users} />
                        </div>
                    </div>

                    {/* Manager Information */}
                    <div className="mb-8">
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <User className="w-5 h-5 text-blue-500" />
                            معلومات المدير
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DataField label="رقم هوية المدير" value={localShelter.manager_id_number} icon={User} dir="ltr" />
                            <DataField label="اسم المدير" value={localShelter.manager_name} icon={User} />
                            <DataField label="رقم هاتف المدير" value={localShelter.manager_phone} icon={Phone} dir="ltr" />
                            <DataField label="رقم هاتف بديل" value={localShelter.manager_alternative_phone} icon={Phone} dir="ltr" />
                            <DataField label="وصف وظيفة المدير" value={localShelter.manager_job_description} icon={Info} />
                        </div>
                    </div>

                    {/* Deputy Manager Information */}
                    {localShelter.deputy_manager_name && (
                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <User className="w-5 h-5 text-green-500" />
                                معلومات نائب المدير
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <DataField label="رقم هوية نائب المدير" value={localShelter.deputy_manager_id_number} icon={User} dir="ltr" />
                                <DataField label="اسم نائب المدير" value={localShelter.deputy_manager_name} icon={User} />
                                <DataField label="رقم هاتف نائب المدير" value={localShelter.deputy_manager_phone} icon={Phone} dir="ltr" />
                                <DataField label="رقم هاتف بديل" value={localShelter.deputy_manager_alternative_phone} icon={Phone} dir="ltr" />
                                <DataField label="وصف وظيفة نائب المدير" value={localShelter.deputy_manager_job_description} icon={Info} />
                            </div>
                        </div>
                    )}

                    {/* Excel File */}
                    {localShelter.excel_sheet && (
                        <div className="mb-8">
                            <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <FileText className="w-5 h-5 text-purple-500" />
                                ملف Excel
                            </h3>
                            <div className="p-4 bg-gray-50 rounded-2xl">
                                <a
                                    href={`${API_BASE}/excel/${localShelter.manager_id_number}`}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-400 to-green-500 text-white rounded-xl hover:from-green-500 hover:to-green-600 transform hover:scale-105 transition-all duration-300 shadow-md shadow-green-200"
                                >
                                    <FileText className="w-5 h-5" />
                                    تحميل ملف Excel
                                </a>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-gray-200">
                        <button
                            onClick={handleEditClick}
                            className="flex-1 min-w-[200px] group relative overflow-hidden px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            <div className="relative flex items-center justify-center gap-3">
                                <Edit className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span>تعديل بيانات المخيم</span>
                            </div>
                        </button>

                        <button
                            onClick={onNewSearch}
                            className="flex-1 min-w-[200px] group relative overflow-hidden px-8 py-4 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-gray-500/30 hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            <div className="relative flex items-center justify-center gap-3">
                                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span>بحث جديد</span>
                            </div>
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit Modal */}
            <EditShelterModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                shelterId={localShelter.manager_id_number}
                onUpdateSuccess={handleUpdateSuccess}
            />
        </>
    );
};

export default ShelterDetails;

