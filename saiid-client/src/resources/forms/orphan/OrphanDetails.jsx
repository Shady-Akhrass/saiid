import React, { useState, useEffect } from 'react';
import { Info, Edit, Lock, Trash2, CheckCircle, Search, FileText, Image as ImageIcon, FileSpreadsheet } from 'lucide-react';
import apiClient from '../../../utils/axiosConfig';
import { ImagePreviewCard } from '../images/ImageComponents';
import GuardianVerificationModal from '../../modals/GuardianVerificationModal';
import EditOrphanModal from '../../modals/EditOrphanModal';
import DeleteOrphanModal from '../../modals/DeleteOrphanModal';

const OrphanDetails = ({ orphan, onEdit, onNewSearch, onUpdateSuccess, onDeleteSuccess }) => {
    // local copy of orphan to support optimistic UI updates
    const [localOrphan, setLocalOrphan] = useState(orphan);
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [verificationType, setVerificationType] = useState(null); // 'edit' or 'delete'
    const [isUpdating, setIsUpdating] = useState(false);
    const [rollbackTimer, setRollbackTimer] = useState(null);
    const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    // Document Download Handlers
    const handleDownloadPdf = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            const orphanId = localOrphan.orphan_id_number || localOrphan.id;
            const response = await apiClient.get(`/orphans/${orphanId}/export-pdf`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `orphan_${orphanId}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Download failed:', err);
            alert('فشل تحميل ملف PDF');
        } finally {
            setIsDownloading(false);
        }
    };

    const handleDownloadPdfClick = () => {
        setVerificationType('download_pdf');
        setShowVerificationModal(true);
    };

    // Handle edit button click - show verification modal
    const handleEditClick = () => {
        setVerificationType('edit');
        setShowVerificationModal(true);
    };

    // Handle delete button click - show verification modal
    const handleDeleteClick = () => {
        setVerificationType('delete');
        setShowVerificationModal(true);
    };

    // Verify guardian ID
    const verifyGuardianId = async (enteredId) => {
        const storedId = localOrphan.guardian_id_number?.trim();
        const inputId = enteredId?.trim();

        if (storedId === inputId) {
            setShowVerificationModal(false);

            // Open appropriate modal based on verification type
            if (verificationType === 'edit') {
                setShowEditModal(true);
            } else if (verificationType === 'delete') {
                setShowDeleteModal(true);
            } else if (verificationType === 'download_pdf') {
                handleDownloadPdf();
            }

            return true;
        }

        return false;
    };

    // keep localOrphan in sync if parent passes a different orphan
    useEffect(() => {
        setLocalOrphan(orphan);
    }, [orphan]);

    // Handle save from edit modal
    // handle update notifications from EditOrphanModal
    const handleModalUpdate = (newData, originalData, status) => {
        // status: 'optimistic' | 'success' | 'failure'
        if (status === 'optimistic') {
            // apply optimistic update locally
            setLocalOrphan(prev => ({ ...prev, ...newData }));

            // set a fallback rollback in case server doesn't respond in time (optional)
            if (rollbackTimer) clearTimeout(rollbackTimer);
            const timer = setTimeout(() => {
                // after 20s, if still optimistic, we revert (server should normally respond sooner)
                setLocalOrphan(originalData);
            }, 20000);
            setRollbackTimer(timer);
            setIsUpdating(true);
        } else if (status === 'success') {
            // clear rollback and mark update complete
            if (rollbackTimer) {
                clearTimeout(rollbackTimer);
                setRollbackTimer(null);
            }
            setLocalOrphan(newData);
            setIsUpdating(false);
            setShowEditModal(false);
            // bubble up if parent wants to know
            if (onUpdateSuccess) onUpdateSuccess(newData);
        } else if (status === 'failure') {
            // revert to original and show error
            if (rollbackTimer) {
                clearTimeout(rollbackTimer);
                setRollbackTimer(null);
            }
            setLocalOrphan(originalData || orphan);
            setIsUpdating(false);
            alert('فشل في تحديث البيانات، تم التراجع عن التعديلات');
        }
    };

    // Handle delete success
    const handleDeleteSuccess = () => {
        setShowDeleteModal(false);

        // Show success message overlay
        setShowDeleteSuccess(true);

        // Wait 2 seconds, then call parent callback or redirect
        setTimeout(() => {
            setShowDeleteSuccess(false);

            if (onDeleteSuccess) {
                // Let parent handle what to do after delete
                onDeleteSuccess(localOrphan);
            } else {
                // Fallback: go to new search
                onNewSearch();
            }
        }, 2000);
    };

    // Success overlay after deletion
    if (showDeleteSuccess) {
        return (
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl p-16 animate-fadeIn text-center">
                <div className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center mb-8 animate-bounce">
                    <CheckCircle className="w-16 h-16 text-green-500" strokeWidth={2.5} />
                </div>
                <h3 className="text-4xl font-bold text-gray-900 mb-4">تم الحذف بنجاح!</h3>
                <p className="text-gray-600 text-xl max-w-md mx-auto">
                    تم حذف سجل <span className="font-bold text-gray-900">{localOrphan.orphan_full_name}</span> وجميع البيانات المرتبطة به
                </p>
                <div className="mt-8">
                    <div className="inline-block animate-spin rounded-full h-10 w-10 border-4 border-green-200 border-t-green-500"></div>
                </div>
            </div>
        );
    }

    // Data field component for consistency
    const DataField = ({ label, value, highlight = false }) => (
        <div className={`p-4 rounded-2xl transition-all duration-300 hover:bg-blue-50 ${highlight ? 'bg-blue-50' : 'bg-gray-50'}`}>
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide block mb-2">
                {label}
            </span>
            <p className="font-semibold text-gray-900 text-lg">
                {value || '—'}
            </p>
        </div>
    );

    return (
        <>
            <div className="bg-white rounded-3xl overflow-hidden animate-fadeIn">
                {/* Header Section */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-white/20 backdrop-blur-sm p-3 rounded-xl">
                            <Info className="w-6 h-6 text-white" strokeWidth={2.5} />
                        </div>
                        <h3 className="text-2xl font-bold text-white">
                            بيانات اليتيم المسجل
                        </h3>
                    </div>
                    <p className="text-blue-100 text-sm mr-16">
                        معلومات شاملة عن اليتيم والوصي
                    </p>
                </div>

                {/* Main Content */}
                <div className="py-8">
                    {/* Orphan Information */}
                    <div className="mb-8">
                        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                            بيانات اليتيم
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <DataField label="الاسم الكامل" value={localOrphan.orphan_full_name} highlight />
                            <DataField label="رقم الهوية" value={localOrphan.orphan_id_number} />
                            <DataField label="تاريخ الميلاد" value={localOrphan.orphan_birth_date} />
                            <DataField label="الجنس" value={localOrphan.orphan_gender} />
                            <DataField label="العنوان الحالي" value={localOrphan.current_address} />
                            <DataField label="اسم الوصي" value={localOrphan.guardian_full_name} />
                        </div>
                    </div>

                    {/* Images Section */}
                    <div className="mb-8">
                        <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                            <div className="w-1 h-6 bg-purple-500 rounded-full"></div>
                            الوثائق المرفقة
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl">
                                <div className="flex items-center gap-2 mb-4">
                                    <ImageIcon className="w-5 h-5 text-blue-600" />
                                    <span className="font-semibold text-gray-900">صورة اليتيم</span>
                                </div>
                                <ImagePreviewCard
                                    orphanId={localOrphan.id || orphan.id}
                                    orphanIdNumber={localOrphan.orphan_id_number || orphan.orphan_id_number}
                                    type="photo"
                                    title=""
                                    optimisticPreview={localOrphan.orphan_photo_preview}
                                />
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-6 rounded-2xl">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="w-5 h-5 text-purple-600" />
                                    <span className="font-semibold text-gray-900">شهادة الوفاة</span>
                                </div>
                                <ImagePreviewCard
                                    orphanId={localOrphan.id || orphan.id}
                                    orphanIdNumber={localOrphan.orphan_id_number || orphan.orphan_id_number}
                                    type="certificate"
                                    title=""
                                    optimisticPreview={localOrphan.death_certificate_preview}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Security Notice */}
                    <div className="mb-8 bg-gradient-to-r from-amber-50 to-orange-50 p-5 rounded-2xl">
                        <div className="flex items-start gap-3">
                            <div className="bg-amber-100 p-2 rounded-xl mt-0.5">
                                <Lock className="w-5 h-5 text-amber-700" />
                            </div>
                            <div>
                                <h5 className="font-semibold text-amber-900 mb-1">تنبيه أمني</h5>
                                <p className="text-sm text-amber-800">
                                    التعديل أو الحذف يتطلب التحقق من هوية الوصي لضمان أمان البيانات
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-wrap gap-4">
                        <button
                            onClick={handleEditClick}
                            className="flex-1 min-w-[200px] group relative overflow-hidden px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-orange-500/30 hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            <div className="relative flex items-center justify-center gap-3">
                                <Lock className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                <span>تحديث البيانات</span>
                            </div>
                        </button>

                        <button
                            onClick={handleDeleteClick}
                            className="flex-1 min-w-[200px] group relative overflow-hidden px-8 py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl font-semibold transition-all duration-300 hover:shadow-xl hover:shadow-red-500/30 hover:scale-105 active:scale-95"
                        >
                            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-20 transition-opacity"></div>
                            <div className="relative flex items-center justify-center gap-3">
                                <Trash2 className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                <span>حذف السجل</span>
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

                    <div className="flex flex-wrap gap-4 mt-4">
                        <button
                            onClick={handleDownloadPdfClick}
                            disabled={isDownloading}
                            className={`flex flex-1 min-w-[200px] items-center justify-center gap-2 px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold hover:bg-red-100 transition-colors border border-red-200 shadow-sm disabled:opacity-50`}
                            title="تحميل PDF"
                        >
                            <FileText className="w-5 h-5" />
                            {isDownloading ? 'جاري التحميل...' : 'تحميل PDF'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Verification Modal */}
            <GuardianVerificationModal
                isOpen={showVerificationModal}
                onClose={() => {
                    setShowVerificationModal(false);
                    setVerificationType(null);
                }}
                onVerify={verifyGuardianId}
                guardianName={localOrphan.guardian_full_name || orphan.guardian_full_name}
            />

            {/* Edit Modal */}
            <EditOrphanModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                orphanData={localOrphan}
                onUpdateSuccess={handleModalUpdate}
                isUpdating={isUpdating}
            />

            {/* Delete Modal */}
            <DeleteOrphanModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                orphanData={localOrphan}
                onDeleteSuccess={handleDeleteSuccess}
            />
        </>
    );
};

export default OrphanDetails;