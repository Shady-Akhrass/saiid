import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../../../utils/axiosConfig';
import { Search, Home, AlertTriangle } from 'lucide-react';

const ShelterSelect = ({ value, onChange, error, disabled }) => {
    const [shelters, setShelters] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedShelter, setSelectedShelter] = useState(null);
    const dropdownRef = useRef(null);

    const fetchShelters = async (search = '') => {
        setIsLoading(true);
        try {
            // ✅ استخدام apiClient بدلاً من axios مباشرة (لحل مشكلة CORS)
            const response = await apiClient.get('/shelters', {
                params: {
                    searchQuery: search,
                    per_page: 1000,  // ✅ استخدام per_page بدلاً من perPage
                    page: 1,
                    all: true, // ✅ محاولة جلب كل البيانات
                    _t: Date.now(), // ✅ cache busting
                },
                headers: {
                    'Cache-Control': 'no-cache', // ✅ منع cache
                },
                timeout: 30000, // timeout 30 ثانية
            });

            if (import.meta.env.DEV) {
                console.log('📥 Shelters Response:', {
                    status: response.status,
                    data: response.data,
                    hasShelters: !!response.data?.shelters,
                    sheltersCount: Array.isArray(response.data?.shelters) ? response.data.shelters.length : 0,
                    isArray: Array.isArray(response.data),
                });
            }

            // ✅ معالجة أفضل للـ response من السيرفر
            let sheltersArray = [];

            // ✅ محاولة استخراج المخيمات من أماكن مختلفة في الـ response
            if (response.data) {
                if (Array.isArray(response.data.shelters)) {
                    sheltersArray = response.data.shelters;
                } else if (Array.isArray(response.data.data)) {
                    sheltersArray = response.data.data;
                } else if (Array.isArray(response.data)) {
                    sheltersArray = response.data;
                } else if (response.data.shelters && Array.isArray(response.data.shelters.data)) {
                    sheltersArray = response.data.shelters.data;
                } else if (response.data.data && Array.isArray(response.data.data.data)) {
                    sheltersArray = response.data.data.data;
                }
            }

            // ✅ إذا كان هناك pagination، نجمع كل الصفحات
            if (response.data?.currentPage && response.data?.lastPage && response.data.lastPage > 1) {
                const allShelters = [...sheltersArray];

                if (import.meta.env.DEV) {
                    console.log(`📄 Fetching additional shelter pages: 2 to ${response.data.lastPage}`);
                }

                for (let page = 2; page <= response.data.lastPage; page++) {
                    try {
                        // ✅ استخدام apiClient بدلاً من axios
                        const pageResponse = await apiClient.get('/shelters', {
                            params: {
                                searchQuery: search,
                                per_page: 1000,
                                page: page,
                                _t: Date.now(), // ✅ cache busting
                            },
                            headers: {
                                'Cache-Control': 'no-cache',
                            },
                            timeout: 30000,
                        });

                        let pageShelters = [];
                        if (pageResponse.data) {
                            if (Array.isArray(pageResponse.data.shelters)) {
                                pageShelters = pageResponse.data.shelters;
                            } else if (Array.isArray(pageResponse.data.data)) {
                                pageShelters = pageResponse.data.data;
                            } else if (Array.isArray(pageResponse.data)) {
                                pageShelters = pageResponse.data;
                            }
                        }

                        allShelters.push(...pageShelters);

                        if (import.meta.env.DEV) {
                            console.log(`✅ Page ${page}: ${pageShelters.length} shelters`);
                        }
                    } catch (pageError) {
                        console.warn(`⚠️ Failed to fetch shelters page ${page}:`, pageError);
                        break;
                    }
                }

                sheltersArray = allShelters;
            }

            // ✅ تحويل البيانات إلى الصيغة المطلوبة
            const formattedShelters = sheltersArray.map(shelter => ({
                id: shelter.manager_id_number || shelter.id || shelter._id,
                name: shelter.camp_name || shelter.name,
                governorate: shelter.governorate,
                district: shelter.district,
                detailed_address: shelter.detailed_address || '', // ✅ إضافة العنوان التفصيلي
                // ✅ إذا كان can_add_project موجود في الـ response، استخدمه
                // وإلا افترض أنه true (يمكن إضافة مشروع)
                can_add_project: shelter.can_add_project !== undefined
                    ? shelter.can_add_project
                    : true,  // افتراضي: يمكن إضافة مشروع
                incomplete_projects_count: shelter.incomplete_projects_count || 0
            }));

            if (import.meta.env.DEV) {
                console.log(`✅ Loaded ${formattedShelters.length} shelters`);
            }

            setShelters(formattedShelters);
        } catch (error) {
            console.error('❌ Error fetching shelters from server:', error);
            console.error('   Response:', error.response?.data);
            console.error('   Status:', error.response?.status);

            // ✅ إذا كان هناك بيانات في response حتى لو كان هناك خطأ
            if (error.response?.data) {
                const errorData = error.response.data;
                let errorShelters = [];

                if (Array.isArray(errorData.shelters)) {
                    errorShelters = errorData.shelters;
                } else if (Array.isArray(errorData.data)) {
                    errorShelters = errorData.data;
                } else if (Array.isArray(errorData)) {
                    errorShelters = errorData;
                }

                if (errorShelters.length > 0) {
                    console.warn('⚠️ Using shelters from error response:', errorShelters.length);
                    const formattedShelters = errorShelters.map(shelter => ({
                        id: shelter.manager_id_number || shelter.id || shelter._id,
                        name: shelter.camp_name || shelter.name,
                        governorate: shelter.governorate,
                        district: shelter.district,
                        detailed_address: shelter.detailed_address || '', // ✅ إضافة العنوان التفصيلي
                        can_add_project: shelter.can_add_project !== undefined ? shelter.can_add_project : true,
                        incomplete_projects_count: shelter.incomplete_projects_count || 0
                    }));
                    setShelters(formattedShelters);
                    return;
                }
            }

            // في حالة الخطأ، لا نعرض toast مزعج
            if (error.response?.status !== 404) {
                console.warn('⚠️ Failed to fetch shelters, showing empty list');
            }
            setShelters([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            // ✅ جلب المخيمات عند فتح الـ dropdown
            // إذا كانت القائمة فارغة، اجلب بدون search query
            if (shelters.length === 0) {
                fetchShelters('');
            } else {
                // إذا كانت القائمة موجودة، طبق البحث
                fetchShelters(searchQuery);
            }
        } else {
            // ✅ إعادة تعيين search query عند الإغلاق
            setSearchQuery('');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, searchQuery]);

    useEffect(() => {
        // ✅ إذا تم مسح القيمة (null أو '' أو undefined)، امسح المخيم المختار
        if (!value || value === '' || value === null) {
            setSelectedShelter(null);
            return;
        }

        // ✅ إذا كانت القيمة موجودة ولم يكن هناك مخيم مختار، أو إذا تغيرت القيمة
        if (value && (!selectedShelter || selectedShelter.id?.toString() !== value.toString())) {
            // Find the selected shelter from the server
            const findSelectedShelter = async () => {
                try {
                    // ✅ استخدام apiClient بدلاً من axios
                    const response = await apiClient.get('/shelters', {
                        params: {
                            per_page: 1000, // ✅ استخدام per_page
                            page: 1,
                            all: true,
                            _t: Date.now(), // ✅ cache busting
                        },
                        headers: {
                            'Cache-Control': 'no-cache',
                        },
                        timeout: 30000,
                    });

                    // ✅ معالجة أفضل للـ response
                    let sheltersArray = [];
                    if (response.data) {
                        if (Array.isArray(response.data.shelters)) {
                            sheltersArray = response.data.shelters;
                        } else if (Array.isArray(response.data.data)) {
                            sheltersArray = response.data.data;
                        } else if (Array.isArray(response.data)) {
                            sheltersArray = response.data;
                        }
                    }

                    const found = sheltersArray.find(s => {
                        const shelterId = s.manager_id_number || s.id || s._id;
                        return String(shelterId) === String(value) || Number(shelterId) === Number(value);
                    });

                    if (found) {
                        setSelectedShelter({
                            id: found.manager_id_number || found.id || found._id,
                            name: found.camp_name || found.name,
                            governorate: found.governorate,
                            district: found.district,
                            detailed_address: found.detailed_address || '' // ✅ إضافة العنوان التفصيلي
                        });
                    } else {
                        // ✅ إذا لم يتم العثور على المخيم، امسح المخيم المختار
                        setSelectedShelter(null);
                    }
                } catch (err) {
                    console.error('Error fetching selected shelter:', err);
                    setSelectedShelter(null);
                }
            };
            findSelectedShelter();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
                setSearchQuery('');
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (shelter) => {
        setSelectedShelter(shelter);
        onChange({ target: { name: 'shelter_id', value: shelter.id } });
        setIsOpen(false);
        setSearchQuery('');
    };

    // ✅ البحث في: رقم هوية المندوب، اسم المخيم، العنوان التفصيلي، المحافظة، المنطقة
    const filteredShelters = shelters.filter(shelter => {
        const query = searchQuery.toLowerCase().trim();
        if (!query) return true;

        return (
            shelter.id?.toString().includes(searchQuery) ||
            shelter.name?.toLowerCase().includes(query) ||
            shelter.detailed_address?.toLowerCase().includes(query) ||
            shelter.governorate?.toLowerCase().includes(query) ||
            shelter.district?.toLowerCase().includes(query)
        );
    });

    return (
        <div className="relative" ref={ dropdownRef } dir="rtl">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
                المخيم (البحث برقم هوية المندوب أو اسم المخيم أو العنوان) <span className="text-red-500">*</span>
            </label>

            <button
                type="button"
                onClick={ () => !disabled && setIsOpen(!isOpen) }
                disabled={ disabled }
                className={ `w-full px-4 py-3 bg-white border-2 rounded-xl text-right transition-all duration-300 focus:outline-none ${error
                    ? 'border-red-300 focus:border-red-500'
                    : 'border-gray-200 focus:border-sky-400 hover:border-sky-300'
                    } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}` }
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                        <Home className="w-5 h-5 text-gray-400" />
                        { selectedShelter ? (
                            <div className="flex-1 text-right">
                                <p className="font-medium text-gray-800">{ selectedShelter.name }</p>
                                { selectedShelter.detailed_address && (
                                    <p className="text-xs text-gray-600 mt-1">{ selectedShelter.detailed_address }</p>
                                ) }
                                <p className="text-xs text-gray-400 mt-1">رقم هوية المندوب: { selectedShelter.id }</p>
                                <p className="text-sm text-gray-500 mt-1">{ selectedShelter.governorate } - { selectedShelter.district }</p>
                            </div>
                        ) : (
                            <span className="text-gray-500">اختر المخيم...</span>
                        ) }
                    </div>
                    <svg
                        className={ `w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'transform rotate-180' : ''}` }
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={ 2 } d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </button>

            { error && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    { error }
                </p>
            ) }

            { isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-2xl max-h-80 overflow-hidden">
                    {/* Search Input */ }
                    <div className="p-3 border-b border-gray-200">
                        <div className="relative">
                            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={ searchQuery }
                                onChange={ (e) => setSearchQuery(e.target.value) }
                                placeholder="ابحث برقم هوية المندوب أو اسم المخيم أو العنوان..."
                                className="w-full pr-10 pl-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-sky-400 text-right"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Results */ }
                    <div className="overflow-y-auto max-h-64">
                        { isLoading ? (
                            <div className="p-8 text-center">
                                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-sky-500"></div>
                                <p className="mt-2 text-gray-500">جاري التحميل...</p>
                            </div>
                        ) : filteredShelters.length === 0 ? (
                            <div className="p-8 text-center">
                                <p className="text-gray-500">لا توجد مخيمات متاحة</p>
                            </div>
                        ) : (
                            filteredShelters.map((shelter) => (
                                <button
                                    key={ shelter.id }
                                    type="button"
                                    onClick={ () => handleSelect(shelter) }
                                    disabled={ !shelter.can_add_project }
                                    className={ `w-full px-4 py-3 text-right hover:bg-sky-50 transition-colors duration-200 border-b border-gray-100 last:border-b-0 ${!shelter.can_add_project
                                        ? 'opacity-50 cursor-not-allowed bg-gray-50'
                                        : 'cursor-pointer'
                                        } ${selectedShelter?.id === shelter.id ? 'bg-sky-100' : ''}` }
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="font-semibold text-gray-800">{ shelter.name }</p>
                                                { !shelter.can_add_project && (
                                                    <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-full">
                                                        مشاريع غير مكتملة
                                                    </span>
                                                ) }
                                            </div>
                                            { shelter.detailed_address && (
                                                <p className="text-sm text-gray-700 mt-1 font-medium">
                                                    { shelter.detailed_address }
                                                </p>
                                            ) }
                                            <p className="text-xs text-gray-500 mt-1">
                                                رقم هوية المندوب: { shelter.id }
                                            </p>
                                            <p className="text-sm text-gray-600 mt-1">
                                                { shelter.governorate } - { shelter.district }
                                            </p>
                                            { shelter.incomplete_projects_count > 0 && (
                                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    يوجد { shelter.incomplete_projects_count } مشروع غير مكتمل
                                                </p>
                                            ) }
                                        </div>
                                        <Home className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                    </div>
                                </button>
                            ))
                        ) }
                    </div>
                </div>
            ) }
        </div>
    );
};

export default ShelterSelect;

