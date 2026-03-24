import React, { useState, useEffect } from 'react';
import { X, Eye, Image, FileText } from 'lucide-react';
import apiClient from '../../../utils/axiosConfig';

// Image Modal Component with 16:9 aspect ratio
export const ImageModal = ({ isOpen, onClose, imageUrl, title }) => {
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (isOpen && imageUrl) {
            fetchImage();
        }
    }, [isOpen, imageUrl]);

    const fetchImage = async () => {
        setLoading(true);
        setError(false);
        try {
            const response = await axios.get(imageUrl, {
                responseType: 'blob'
            });
            const imageObjectUrl = URL.createObjectURL(response.data);
            setImageData(imageObjectUrl);
        } catch (err) {
            console.error('Error fetching image:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            // Cleanup blob URL when component unmounts
            if (imageData) {
                URL.revokeObjectURL(imageData);
            }
        };
    }, [imageData]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
            onClick={ onClose }
        >
            <div
                className="relative bg-white rounded-lg max-w-6xl w-full"
                onClick={ (e) => e.stopPropagation() }
            >
                {/* Header */ }
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold">{ title }</h3>
                    <button
                        onClick={ onClose }
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Image Container with 16:9 aspect ratio */ }
                <div className="relative w-full" style={ { paddingBottom: '56.25%' } }> {/* 16:9 Aspect Ratio */ }
                    <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                        { loading ? (
                            <div className="flex flex-col items-center justify-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
                                <p className="text-gray-500">جاري تحميل الصورة...</p>
                            </div>
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center">
                                <X className="w-12 h-12 text-red-500 mb-4" />
                                <p className="text-red-500">خطأ في تحميل الصورة</p>
                            </div>
                        ) : imageData ? (
                            <img
                                src={ imageData }
                                alt={ title }
                                className="absolute inset-0 w-full h-full object-contain bg-black"
                                style={ { objectFit: 'contain' } }
                            />
                        ) : null }
                    </div>
                </div>
            </div>
        </div>
    );
};
// Image Preview Card Component - Updated to use orphan_id_number
export const ImagePreviewCard = ({ orphanId, orphanIdNumber, type, title, optimisticPreview }) => {
    const [imageSrc, setImageSrc] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);

    // Since orphan_id_number is the primary key, use it directly
    const idToUse = orphanIdNumber || orphanId;

    // ✅ استخدام endpoint نسبي بدلاً من URL كامل
    const imageEndpoint = idToUse ? (type === 'photo'
        ? `/image/${idToUse}`
        : `/death-certificate/${idToUse}`) : null;

    useEffect(() => {
        let mounted = true;

        // If optimistic preview is provided (data URL or blob URL), use it immediately
        if (optimisticPreview) {
            setImageSrc(optimisticPreview);
            setLoading(false);
            setError(false);
            return;
        }

        if (idToUse) {
            loadThumbnail();
        } else {
            setLoading(false);
            setError(true);
        }

        return () => { mounted = false; };
    }, [idToUse, optimisticPreview]);

    const loadThumbnail = async () => {
        if (!imageEndpoint) {
            setLoading(false);
            setError(true);
            return;
        }

        setLoading(true);
        setError(false);
        try {
            // ✅ استخدام apiClient للصور من API endpoint
            const response = await apiClient.get(imageEndpoint, {
                responseType: 'blob',
                skipDeduplication: true,
            });
            
            const imageObjectUrl = URL.createObjectURL(response.data);
            // revoke previous blob URL if present
            setImageSrc(prev => {
                try {
                    if (prev && typeof prev === 'string' && prev.startsWith('blob:')) {
                        URL.revokeObjectURL(prev);
                    }
                } catch (e) { /* ignore */ }
                return imageObjectUrl;
            });
        } catch (err) {
            console.error('Error loading thumbnail:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleViewClick = () => {
        if (imageEndpoint) {
            setModalOpen(true);
        }
    };

    const Icon = type === 'photo' ? Image : FileText;

    useEffect(() => {
        return () => {
            // cleanup blob URL when component unmounts
            try {
                if (imageSrc && imageSrc.startsWith && imageSrc.startsWith('blob:')) {
                    URL.revokeObjectURL(imageSrc);
                }
            } catch (e) { /* ignore */ }
        };
    }, [imageSrc]);

    return (
        <>
            <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        { title }
                    </span>
                    { idToUse && (
                        <button
                            onClick={ handleViewClick }
                            className="flex items-center gap-1 px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors"
                        >
                            <Eye className="w-4 h-4" />
                            عرض
                        </button>
                    ) }
                </div>

                {/* Thumbnail with 16:9 aspect ratio */ }
                <div
                    className="relative w-full rounded cursor-pointer overflow-hidden bg-gray-100"
                    style={ { paddingBottom: '56.25%' } } /* 16:9 Aspect Ratio */
                    onClick={ handleViewClick }
                >
                    <div className="absolute inset-0">
                        { loading ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
                            </div>
                        ) : error ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <p className="text-gray-400 text-sm">لا توجد صورة</p>
                            </div>
                        ) : (
                            <img
                                src={ imageSrc }
                                alt={ title }
                                className="absolute inset-0 w-full h-full object-cover"
                            />
                        ) }
                    </div>
                </div>
            </div>

            { imageEndpoint && (
                <ImageModal
                    isOpen={ modalOpen }
                    onClose={ () => setModalOpen(false) }
                    imageUrl={ imageEndpoint }
                    title={ title }
                />
            ) }
        </>
    );
};

// Alternative: Full-screen modal with 16:9 constrained view
export const FullScreenImageModal = ({ isOpen, onClose, imageUrl, title }) => {
    const [imageData, setImageData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (isOpen && imageUrl) {
            fetchImage();
        }
    }, [isOpen, imageUrl]);

    const fetchImage = async () => {
        setLoading(true);
        setError(false);
        try {
            // ✅ إذا كان URL كامل (http/https)، استخدمه مباشرة مع fetch
            let blob;
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                const response = await fetch(imageUrl, {
                    method: 'GET',
                    credentials: 'include',
                    mode: 'cors',
                });
                if (!response.ok) throw new Error('Failed to fetch image');
                blob = await response.blob();
            } else {
                // ✅ استخدام apiClient للصور من API endpoint
                let apiEndpoint = imageUrl;
                if (imageUrl.includes('/api/')) {
                    apiEndpoint = imageUrl.split('/api/')[1];
                } else if (imageUrl.startsWith('/')) {
                    apiEndpoint = imageUrl.substring(1);
                }
                
                const response = await apiClient.get(apiEndpoint, {
                    responseType: 'blob',
                    skipDeduplication: true,
                });
                blob = response.data;
            }
            
            const imageObjectUrl = URL.createObjectURL(blob);
            setImageData(imageObjectUrl);
        } catch (err) {
            console.error('Error fetching image:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        return () => {
            if (imageData) {
                URL.revokeObjectURL(imageData);
            }
        };
    }, [imageData]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 bg-black flex flex-col"
            onClick={ onClose }
        >
            {/* Header */ }
            <div className="bg-black bg-opacity-50 p-4 flex justify-between items-center">
                <h3 className="text-white text-lg font-semibold">{ title }</h3>
                <button
                    onClick={ onClose }
                    className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
                >
                    <X className="w-6 h-6 text-white" />
                </button>
            </div>

            {/* Image Container */ }
            <div className="flex-1 flex items-center justify-center p-4">
                <div className="relative w-full max-w-[177.77vh] max-h-[90vh]"> {/* Max width based on 16:9 of viewport height */ }
                    <div className="relative w-full" style={ { paddingBottom: '56.25%' } }> {/* 16:9 Aspect Ratio */ }
                        <div className="absolute inset-0">
                            { loading ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mb-4"></div>
                                    <p className="text-white">جاري تحميل الصورة...</p>
                                </div>
                            ) : error ? (
                                <div className="flex flex-col items-center justify-center h-full">
                                    <X className="w-16 h-16 text-red-500 mb-4" />
                                    <p className="text-red-500">خطأ في تحميل الصورة</p>
                                </div>
                            ) : imageData ? (
                                <img
                                    src={ imageData }
                                    alt={ title }
                                    className="absolute inset-0 w-full h-full object-contain"
                                    onClick={ (e) => e.stopPropagation() }
                                />
                            ) : null }
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};