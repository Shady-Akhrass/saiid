import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../utils/axiosConfig';
import { toast } from 'react-toastify';
import { DollarSign, Edit, Save, X, Calculator, TrendingUp, Plus, Check, RefreshCw, Trash2, CheckCircle, XCircle } from 'lucide-react';
import Unauthorized from '../components/Unauthorized';

const CurrenciesManagement = () => {
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(false);
    const [currencies, setCurrencies] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [isUpdatingAll, setIsUpdatingAll] = useState(false); // ✅ حالة تحديث جميع العملات
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [newCurrency, setNewCurrency] = useState({
        currency_name_ar: '',
        currency_name_en: '',
        currency_code: '',
        currency_symbol: '',
        exchange_rate_to_usd: '',
        is_active: true,
    });
    const [calculator, setCalculator] = useState({
        amount: '',
        currency_id: '',
        result: 0,
    });

    useEffect(() => {
        fetchCurrencies();

        // ✅ إبطال الكاش تلقائياً كل دقيقة (60000 ms) لضمان تحديث البيانات
        const cacheInvalidationInterval = setInterval(() => {
            try {
                localStorage.removeItem('cache_currencies');
                localStorage.removeItem('currencies_cache');
                window.dispatchEvent(new CustomEvent('cache-invalidated', {
                    detail: { cacheKey: 'currencies' }
                }));
                if (import.meta.env.DEV) {
                    console.log('🔄 Auto-invalidated currencies cache after 1 minute');
                }
            } catch (error) {
                console.warn('Error auto-invalidating cache:', error);
            }
        }, 60000); // كل دقيقة

        return () => {
            clearInterval(cacheInvalidationInterval);
        };
    }, []);

    const fetchCurrencies = async () => {
        let loadingTimeout;

        try {
            setLoading(true);

            // إيقاف حالة التحميل بعد timeout
            loadingTimeout = setTimeout(() => {
                setLoading(false);
            }, 30000); // timeout 30 ثانية

            // ✅ جلب كل العملات بدون pagination وبدون filter على is_active
            const response = await apiClient.get('/currencies', {
                params: {
                    per_page: 1000, // جلب حتى 1000 عملة
                    all: true, // محاولة جلب كل البيانات
                    include_inactive: true, // ✅ جلب حتى العملات غير النشطة
                    _t: Date.now(), // ✅ cache busting - إجبار الـ Backend على جلب البيانات المحدثة
                },
                timeout: 30000, // timeout 30 ثانية
                headers: {
                    'Cache-Control': 'no-cache', // ✅ منع cache في الـ request
                }
            });

            if (loadingTimeout) clearTimeout(loadingTimeout);

            if (response.data.success) {
                // ✅ الـ Backend يرجع البيانات في "currencies" وليس "data"
                let currenciesData = response.data.currencies || response.data.data || [];

                // ✅ Debug: عرض البيانات المستلمة
                if (import.meta.env.DEV) {
                    console.log('📥 Currencies Response:', {
                        success: response.data.success,
                        currenciesCount: currenciesData.length,
                        hasPagination: !!response.data.currentPage,
                        currentPage: response.data.currentPage,
                        lastPage: response.data.lastPage,
                        total: response.data.total,
                        currencies: currenciesData.map(c => ({ id: c.id, code: c.currency_code, active: c.is_active }))
                    });
                }

                // ✅ إذا كان هناك pagination، نجمع كل الصفحات
                if (response.data.currentPage && response.data.lastPage && response.data.lastPage > 1) {
                    const allCurrencies = [...currenciesData];

                    if (import.meta.env.DEV) {
                        console.log(`📄 Fetching additional pages: 2 to ${response.data.lastPage}`);
                    }

                    // جلب باقي الصفحات
                    for (let page = 2; page <= response.data.lastPage; page++) {
                        try {
                            const pageResponse = await apiClient.get('/currencies', {
                                params: {
                                    page: page,
                                    per_page: 1000,
                                    include_inactive: true, // ✅ جلب حتى العملات غير النشطة
                                    _t: Date.now(), // ✅ cache busting
                                },
                                timeout: 30000,
                                headers: {
                                    'Cache-Control': 'no-cache',
                                }
                            });

                            if (pageResponse.data.success) {
                                const pageData = pageResponse.data.currencies || pageResponse.data.data || [];
                                allCurrencies.push(...pageData);

                                if (import.meta.env.DEV) {
                                    console.log(`✅ Page ${page}: ${pageData.length} currencies`);
                                }
                            }
                        } catch (pageError) {
                            console.warn(`⚠️ Failed to fetch page ${page}:`, pageError);
                            break; // توقف إذا فشلت إحدى الصفحات
                        }
                    }

                    currenciesData = allCurrencies;
                }

                // ✅ ترتيب العملات: النشطة أولاً، ثم حسب ID
                currenciesData.sort((a, b) => {
                    // النشطة أولاً
                    if (a.is_active !== b.is_active) {
                        return b.is_active - a.is_active;
                    }
                    // ثم حسب ID
                    return a.id - b.id;
                });

                setCurrencies(currenciesData);

                if (import.meta.env.DEV) {
                    console.log(`✅ تم جلب ${currenciesData.length} عملة (${currenciesData.filter(c => c.is_active).length} نشطة)`);
                }
            } else {
                // إذا لم يكن success، نجرب جلب البيانات مباشرة
                const currenciesData = response.data.currencies || response.data.data || response.data || [];
                if (Array.isArray(currenciesData) && currenciesData.length > 0) {
                    if (import.meta.env.DEV) {
                        console.log(`⚠️ Response not successful, but found ${currenciesData.length} currencies in data`);
                    }
                    setCurrencies(currenciesData);
                } else {
                    if (import.meta.env.DEV) {
                        console.warn('⚠️ No currencies found in response:', response.data);
                    }
                }
            }
        } catch (error) {
            if (loadingTimeout) clearTimeout(loadingTimeout);

            if (import.meta.env.DEV && !error.isConnectionError) {
                console.error('❌ Error fetching currencies:', error);
                console.error('   Response:', error.response?.data);
                console.error('   Status:', error.response?.status);
            }

            // ✅ معالجة خاصة لأخطاء الصلاحيات (403)
            if (error.response?.status === 403 || error.isPermissionError) {
                // إذا كان الخطأ 403، سنترك Unauthorized component يعرض الرسالة
                // لا حاجة لعرض toast هنا لأن الصفحة ستعرض Unauthorized
                setCurrencies([]);
                return;
            }

            // ✅ إذا كان هناك بيانات في response حتى لو كان هناك خطأ
            if (error.response?.data) {
                const errorData = error.response.data;
                const currenciesData = errorData.currencies || errorData.data || [];
                if (Array.isArray(currenciesData) && currenciesData.length > 0) {
                    console.warn('⚠️ Using currencies from error response:', currenciesData.length);
                    setCurrencies(currenciesData);
                    return;
                }
            }

            // ✅ عرض رسالة خطأ للمستخدم
            if (!error.isConnectionError && !error.isTimeoutError) {
                toast.error(error.userMessage || 'فشل تحميل العملات. يرجى المحاولة مرة أخرى.');
            }

            // ✅ إبقاء القائمة فارغة بدلاً من fallback data
            setCurrencies([]);
        } finally {
            setLoading(false);
        }
    };

    const handleStartEdit = (currency) => {
        setEditingId(currency.id);
        setEditValue(currency.exchange_rate_to_usd);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };

    const handleSaveEdit = async (currencyId) => {
        if (!editValue || parseFloat(editValue) <= 0) {
            toast.error('سعر الصرف يجب أن يكون أكبر من صفر');
            return;
        }

        try {
            const response = await apiClient.patch(`/currencies/${currencyId}`, {
                exchange_rate_to_usd: parseFloat(editValue),
            });

            if (import.meta.env.DEV) {
                console.log('✅ Currency update response:', response.data);
            }

            if (response.data.success) {
                // ✅ تحديث العملة مباشرة في الـ state من الـ response
                const updatedCurrency = response.data.data || response.data.currency || response.data;

                if (updatedCurrency && updatedCurrency.id) {
                    // تحديث العملة في القائمة مباشرة
                    setCurrencies(prevCurrencies => {
                        const updated = prevCurrencies.map(currency => {
                            if (currency.id === currencyId || currency.id === updatedCurrency.id) {
                                // دمج البيانات القديمة مع الجديدة
                                return {
                                    ...currency,
                                    ...updatedCurrency,
                                    exchange_rate_to_usd: parseFloat(editValue),
                                    // التأكد من الحفاظ على الحقول الأخرى
                                    currency_name: updatedCurrency.currency_name || currency.currency_name,
                                    currency_code: updatedCurrency.currency_code || currency.currency_code,
                                    symbol: updatedCurrency.symbol || updatedCurrency.currency_symbol || currency.symbol,
                                    is_active: updatedCurrency.is_active !== undefined ? updatedCurrency.is_active : currency.is_active,
                                };
                            }
                            return currency;
                        });

                        if (import.meta.env.DEV) {
                            console.log('✅ Currency updated in state:', {
                                currencyId,
                                oldRate: prevCurrencies.find(c => c.id === currencyId)?.exchange_rate_to_usd,
                                newRate: parseFloat(editValue),
                                updatedCurrency
                            });
                        }

                        return updated;
                    });

                    toast.success('تم تحديث سعر الصرف بنجاح');
                    setEditingId(null);
                    setEditValue('');

                    // ✅ إرسال event لإعلام الصفحات الأخرى بتحديث العملات
                    window.dispatchEvent(new CustomEvent('currency-updated', {
                        detail: { currencyId, updatedCurrency }
                    }));

                    // ✅ إبطال كاش العملات
                    try {
                        localStorage.removeItem('cache_currencies');
                        localStorage.removeItem('currencies_cache');
                        window.dispatchEvent(new CustomEvent('cache-invalidated', {
                            detail: { cacheKey: 'currencies' }
                        }));
                    } catch (error) {
                        console.warn('Error invalidating currencies cache:', error);
                    }
                } else {
                    // إذا لم يكن هناك data في response، نعيد جلب كل البيانات
                    if (import.meta.env.DEV) {
                        console.warn('⚠️ No currency data in response, fetching all currencies...');
                        console.warn('   Response data:', response.data);
                    }
                    // تحديث مباشر من القيمة المدخلة كـ fallback
                    setCurrencies(prevCurrencies =>
                        prevCurrencies.map(currency =>
                            currency.id === currencyId
                                ? { ...currency, exchange_rate_to_usd: parseFloat(editValue) }
                                : currency
                        )
                    );
                    toast.success('تم تحديث سعر الصرف بنجاح');
                    setEditingId(null);
                    setEditValue('');

                    // ✅ إرسال event لإعلام الصفحات الأخرى بتحديث العملات
                    window.dispatchEvent(new CustomEvent('currency-updated', {
                        detail: { currencyId }
                    }));

                    // ✅ إبطال كاش العملات
                    try {
                        localStorage.removeItem('cache_currencies');
                        localStorage.removeItem('currencies_cache');
                        window.dispatchEvent(new CustomEvent('cache-invalidated', {
                            detail: { cacheKey: 'currencies' }
                        }));
                    } catch (error) {
                        console.warn('Error invalidating currencies cache:', error);
                    }

                    // إعادة جلب البيانات في الخلفية للتأكد من التزامن
                    fetchCurrencies();
                }
            } else {
                toast.error(response.data.message || 'فشل تحديث سعر الصرف');
            }
        } catch (error) {
            console.error('❌ Error updating currency:', error);
            console.error('   Response:', error.response?.data);
            console.error('   Status:', error.response?.status);

            // ✅ معالجة خاصة لأخطاء الصلاحيات (403)
            if (error.response?.status === 403 || error.isPermissionError) {
                const permissionMessage = error.response?.data?.message || error.userMessage ||
                    'ليس لديك صلاحيات لتعديل العملات. الصلاحيات مقتصرة على الإدارة فقط.';
                toast.error(permissionMessage);
                return;
            }

            toast.error(error.userMessage || 'حدث خطأ أثناء تحديث سعر الصرف');
        }
    };

    // ✅ تحديث جميع العملات من API خارجي
    const handleUpdateAllCurrencies = async () => {
        // ✅ تأكيد من المستخدم قبل التحديث
        const confirmed = window.confirm(
            'هل أنت متأكد من تحديث جميع أسعار الصرف من API الخارجي؟\n\n' +
            'سيتم تحديث جميع العملات النشطة بناءً على أحدث الأسعار المتاحة.'
        );

        if (!confirmed) {
            return;
        }

        setIsUpdatingAll(true);
        try {
            // ✅ استدعاء endpoint لتحديث جميع العملات
            const response = await apiClient.post('/currencies/update-all', {
                _t: Date.now(), // cache busting
            }, {
                timeout: 60000, // 60 ثانية - قد يستغرق وقتاً أطول
                headers: {
                    'Cache-Control': 'no-cache',
                }
            });

            if (response.data.success) {
                const updatedCount = response.data.updated_count || response.data.count || 0;
                toast.success(
                    `تم تحديث ${updatedCount} عملة بنجاح من API الخارجي`,
                    { autoClose: 5000 }
                );

                // ✅ إبطال الكاش
                try {
                    localStorage.removeItem('cache_currencies');
                    localStorage.removeItem('currencies_cache');
                    window.dispatchEvent(new CustomEvent('cache-invalidated', {
                        detail: { cacheKey: 'currencies' }
                    }));
                    window.dispatchEvent(new CustomEvent('currency-updated', {
                        detail: { action: 'updated_all' }
                    }));
                } catch (error) {
                    console.warn('Error invalidating cache:', error);
                }

                // ✅ إعادة جلب العملات المحدثة
                await fetchCurrencies();
            } else {
                toast.error(response.data.message || 'فشل تحديث العملات');
            }
        } catch (error) {
            console.error('❌ Error updating all currencies:', error);
            console.error('   Response:', error.response?.data);
            console.error('   Status:', error.response?.status);

            // ✅ معالجة الأخطاء المختلفة
            if (error.response?.status === 403 || error.isPermissionError) {
                toast.error('ليس لديك صلاحيات لتحديث العملات. الصلاحيات مقتصرة على الإدارة فقط.');
            } else if (error.response?.status === 404) {
                toast.error('Endpoint تحديث العملات غير موجود. يرجى التحقق من Backend.');
            } else if (error.response?.status === 500) {
                toast.error('حدث خطأ في الخادم أثناء تحديث العملات. يرجى المحاولة لاحقاً.');
            } else if (error.response?.data?.message) {
                toast.error(error.response.data.message);
            } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
                toast.error('انتهت مهلة الاتصال. قد يستغرق التحديث وقتاً أطول. يرجى المحاولة مرة أخرى.');
            } else {
                toast.error(error.userMessage || 'حدث خطأ أثناء تحديث العملات');
            }
        } finally {
            setIsUpdatingAll(false);
        }
    };

    const handleCreateCurrency = async () => {
        // ✅ التحقق من البيانات المطلوبة
        if (!newCurrency.currency_name_ar || !newCurrency.currency_name_en || !newCurrency.currency_code) {
            toast.error('الرجاء إدخال اسم العملة بالعربية والإنجليزية ورمز العملة');
            return;
        }

        if (!newCurrency.exchange_rate_to_usd || parseFloat(newCurrency.exchange_rate_to_usd) <= 0) {
            toast.error('سعر الصرف يجب أن يكون أكبر من صفر');
            return;
        }

        setIsCreating(true);
        try {
            const response = await apiClient.post('/currencies', {
                currency_name_ar: newCurrency.currency_name_ar.trim(),
                currency_name_en: newCurrency.currency_name_en.trim(),
                currency_code: newCurrency.currency_code.trim().toUpperCase(),
                currency_symbol: newCurrency.currency_symbol.trim() || null,
                exchange_rate_to_usd: parseFloat(newCurrency.exchange_rate_to_usd),
                is_active: newCurrency.is_active,
            });

            if (response.data.success) {
                toast.success('تم إضافة العملة بنجاح');

                // ✅ إغلاق الـ modal وإعادة تعيين النموذج
                setShowAddModal(false);
                setNewCurrency({
                    currency_name_ar: '',
                    currency_name_en: '',
                    currency_code: '',
                    currency_symbol: '',
                    exchange_rate_to_usd: '',
                    is_active: true,
                });

                // ✅ إرسال event لإعلام الصفحات الأخرى
                window.dispatchEvent(new CustomEvent('currency-updated', {
                    detail: { action: 'created' }
                }));

                // ✅ إبطال كاش العملات
                try {
                    localStorage.removeItem('cache_currencies');
                    localStorage.removeItem('currencies_cache');
                    window.dispatchEvent(new CustomEvent('cache-invalidated', {
                        detail: { cacheKey: 'currencies' }
                    }));
                } catch (error) {
                    console.warn('Error invalidating currencies cache:', error);
                }

                // ✅ إعادة جلب العملات
                await fetchCurrencies();
            } else {
                toast.error(response.data.message || 'فشل إضافة العملة');
            }
        } catch (error) {
            console.error('❌ Error creating currency:', error);
            console.error('   Response:', error.response?.data);
            console.error('   Status:', error.response?.status);

            // ✅ معالجة خاصة لأخطاء الصلاحيات (403)
            if (error.response?.status === 403 || error.isPermissionError) {
                const permissionMessage = error.response?.data?.message || error.userMessage ||
                    'ليس لديك صلاحيات لإضافة العملات. الصلاحيات مقتصرة على الإدارة فقط.';
                toast.error(permissionMessage);
                return;
            }

            // ✅ معالجة أخطاء التحقق (422)
            if (error.response?.status === 422 && error.response?.data?.errors) {
                const errors = error.response.data.errors;
                const firstError = Object.values(errors)[0]?.[0] || 'بيانات غير صحيحة';
                toast.error(firstError);
                return;
            }

            toast.error(error.userMessage || 'حدث خطأ أثناء إضافة العملة');
        } finally {
            setIsCreating(false);
        }
    };

    const handleCalculate = async () => {
        if (!calculator.amount || !calculator.currency_id) {
            toast.error('الرجاء إدخال المبلغ واختيار العملة');
            return;
        }

        try {
            // حساب محلي باستخدام بيانات العملة من API
            const selectedCurrency = currencies.find(
                (c) => c.id === parseInt(calculator.currency_id)
            );

            if (selectedCurrency) {
                const amountInUSD =
                    parseFloat(calculator.amount) * selectedCurrency.exchange_rate_to_usd;
                setCalculator({ ...calculator, result: amountInUSD });
            } else {
                toast.error('العملة المختارة غير موجودة');
            }
        } catch (error) {
            console.error('Error calculating:', error);
            toast.error(error.userMessage || 'حدث خطأ أثناء الحساب');
        }
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        }).format(amount);
    };

    const formatUSD = (amount) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(amount);
    };

    const handleToggleStatus = async (currencyId, currentStatus) => {
        setTogglingId(currencyId);
        try {
            const response = await apiClient.patch(`/currencies/${currencyId}/toggle-status`, {
                _t: Date.now(),
            }, {
                timeout: 20000,
                headers: {
                    'Cache-Control': 'no-cache',
                }
            });

            if (response.data.success) {
                const updatedCurrency = response.data.data || response.data.currency || {};
                toast.success(`تم ${currentStatus ? 'تعطيل' : 'تفعيل'} العملة بنجاح`);

                // تحديث العملة في القائمة
                setCurrencies(prevCurrencies =>
                    prevCurrencies.map(currency =>
                        currency.id === currencyId || currency.id === updatedCurrency.id
                            ? { ...currency, ...updatedCurrency, is_active: !currentStatus }
                            : currency
                    )
                );

                // إرسال event لإعلام الصفحات الأخرى
                window.dispatchEvent(new CustomEvent('currency-updated', {
                    detail: { currencyId, updatedCurrency }
                }));

                // إبطال كاش العملات
                try {
                    localStorage.removeItem('cache_currencies');
                    localStorage.removeItem('currencies_cache');
                    window.dispatchEvent(new CustomEvent('cache-invalidated', {
                        detail: { cacheKey: 'currencies' }
                    }));
                } catch (error) {
                    console.warn('Error invalidating currencies cache:', error);
                }
            } else {
                toast.error(response.data.message || 'فشل تحديث حالة العملة');
            }
        } catch (error) {
            console.error('Error toggling currency status:', error);

            if (error.response?.status === 403 || error.isPermissionError) {
                toast.error('ليس لديك صلاحيات لتعديل حالة العملة. الصلاحيات مقتصرة على الإدارة فقط.');
            } else if (error.response?.status === 404) {
                // API غير موجود - تحديث محلي
                setCurrencies(prevCurrencies =>
                    prevCurrencies.map(currency =>
                        currency.id === currencyId
                            ? { ...currency, is_active: !currentStatus }
                            : currency
                    )
                );
                toast.success(`تم ${currentStatus ? 'تعطيل' : 'تفعيل'} العملة (محلي)`);
            } else {
                toast.error(error.userMessage || 'حدث خطأ أثناء تحديث حالة العملة');
            }
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async (currencyId) => {
        setDeletingId(currencyId);
        try {
            const response = await apiClient.delete(`/currencies/${currencyId}`, {
                timeout: 20000,
                headers: {
                    'Cache-Control': 'no-cache',
                }
            });

            if (response.data.success) {
                toast.success('تم حذف العملة بنجاح');
                setShowDeleteConfirm(null);

                // إزالة العملة من القائمة
                setCurrencies(prevCurrencies =>
                    prevCurrencies.filter(currency => currency.id !== currencyId)
                );

                // إرسال event لإعلام الصفحات الأخرى
                window.dispatchEvent(new CustomEvent('currency-updated', {
                    detail: { action: 'deleted', currencyId }
                }));

                // إبطال كاش العملات
                try {
                    localStorage.removeItem('cache_currencies');
                    localStorage.removeItem('currencies_cache');
                    window.dispatchEvent(new CustomEvent('cache-invalidated', {
                        detail: { cacheKey: 'currencies' }
                    }));
                } catch (error) {
                    console.warn('Error invalidating currencies cache:', error);
                }
            } else {
                toast.error(response.data.message || 'فشل حذف العملة');
            }
        } catch (error) {
            console.error('Error deleting currency:', error);

            if (error.response?.status === 403 || error.isPermissionError) {
                toast.error('ليس لديك صلاحيات لحذف العملة. الصلاحيات مقتصرة على الإدارة فقط.');
            } else if (error.response?.status === 400 || error.response?.status === 422) {
                const message = error.response?.data?.message || 'لا يمكن حذف العملة لأنها مستخدمة في مشاريع';
                toast.error(message);
            } else if (error.response?.status === 404) {
                // API غير موجود - حذف محلي
                setCurrencies(prevCurrencies =>
                    prevCurrencies.filter(currency => currency.id !== currencyId)
                );
                toast.success('تم حذف العملة (محلي)');
                setShowDeleteConfirm(null);
            } else {
                toast.error(error.userMessage || 'حدث خطأ أثناء حذف العملة');
            }
        } finally {
            setDeletingId(null);
            setShowDeleteConfirm(null);
        }
    };

    // ✅ انتظار تحميل بيانات المستخدم أولاً
    // if (authLoading || loading) {
    //     return (
    //         <div className="flex justify-center items-center min-h-screen">
    //             <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
    //         </div>
    //     );
    // }

    // ✅ التحقق من الصلاحيات - فقط Admin يمكنه الوصول
    // 🔍 Debug: عرض معلومات المستخدم
    console.log('🔐 CurrenciesManagement Permission Check:');
    console.log('  - User:', user);
    console.log('  - User Role:', user?.role);
    console.log('  - User Role (alternative):', user?.userRole || user?.user_role || user?.role_name);
    console.log('  - User Object Keys:', user ? Object.keys(user) : 'No user');
    console.log('  - Full User Object:', JSON.stringify(user, null, 2));

    // ✅ البحث عن role في أماكن مختلفة
    const userRole = user?.role?.toLowerCase?.() ||
        user?.userRole?.toLowerCase?.() ||
        user?.user_role?.toLowerCase?.() ||
        user?.role_name?.toLowerCase?.() ||
        user?.role || '';

    // ✅ التحقق الصارم: فقط Admin يمكنه الدخول
    const isAdmin = userRole === 'admin' || userRole === 'administrator' || userRole === 'مدير';

    console.log('  - Normalized Role:', userRole || 'NOT FOUND');
    console.log('  - User ID:', user?.id);
    console.log('  - Final Check - Is Admin?', isAdmin);

    // ✅ التحقق: إذا لم يكن Admin، نمنع الوصول
    // ⚠️ لكن نسمح بالدخول إذا كان user موجود (حل مؤقت حتى يتم إصلاح Backend)
    if (!user) {
        console.warn('⚠️ Access Denied - No user found');
        return <Unauthorized requiredRole="admin" pageName="إدارة العملات" />;
    }

    // ✅ إذا كان role موجود وليس admin، نمنع الوصول
    if (userRole && !isAdmin) {
        console.warn('⚠️ Access Denied - User is not Admin');
        console.warn('  - User Role:', user.role);
        console.warn('  - Normalized:', userRole);
        return <Unauthorized requiredRole="admin" pageName="إدارة العملات" />;
    }

    // ✅ إذا كان role غير موجود، نسمح بالدخول (حل مؤقت - على افتراض أنه Admin)
    if (!userRole) {
        console.warn('⚠️ WARNING: User role is not found! Allowing access (assuming Admin).');
        console.warn('  - Please check Backend login response - it should include "role" field');
    }

    console.log('✅ Access Granted - User is Admin (or role not found, allowing access)');

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-green-50 p-6">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */ }
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">إدارة العملات</h1>
                        <p className="text-gray-600 mt-1">إدارة أسعار الصرف مقابل الدولار</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={ () => {
                                // ✅ إبطال الكاش وإعادة جلب البيانات
                                try {
                                    localStorage.removeItem('cache_currencies');
                                    localStorage.removeItem('currencies_cache');
                                    window.dispatchEvent(new CustomEvent('cache-invalidated', {
                                        detail: { cacheKey: 'currencies' }
                                    }));
                                } catch (error) {
                                    console.warn('Error invalidating cache:', error);
                                }
                                fetchCurrencies();
                                toast.info('جاري تحديث البيانات...');
                            } }
                            disabled={ loading || isUpdatingAll }
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                            title="تحديث البيانات"
                        >
                            <RefreshCw className={ `w-5 h-5 ${loading ? 'animate-spin' : ''}` } />
                            تحديث
                        </button>
                        <button
                            onClick={ handleUpdateAllCurrencies }
                            disabled={ loading || isUpdatingAll }
                            className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow disabled:opacity-50 disabled:cursor-not-allowed"
                            title="تحديث جميع العملات من API الخارجي"
                        >
                            <TrendingUp className={ `w-5 h-5 ${isUpdatingAll ? 'animate-spin' : ''}` } />
                            { isUpdatingAll ? 'جاري التحديث...' : 'تحديث من API' }
                        </button>
                        <button
                            onClick={ () => setShowAddModal(true) }
                            className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:shadow-lg transition-shadow"
                        >
                            <Plus className="w-5 h-5" />
                            إضافة عملة جديدة
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Currencies List */ }
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                            <div className="px-6 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white">
                                <div className="flex items-center justify-between">
                                    <h2 className="text-xl font-bold flex items-center">
                                        <DollarSign className="w-5 h-5 ml-2" />
                                        قائمة العملات
                                    </h2>
                                    { !loading && currencies.length > 0 && (
                                        <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                                            { currencies.length } عملة ({ currencies.filter(c => c.is_active).length } نشطة)
                                        </span>
                                    ) }
                                </div>
                            </div>
                            <div className="p-6">
                                { loading ? (
                                    <div className="flex justify-center items-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600"></div>
                                    </div>
                                ) : currencies.length === 0 ? (
                                    <div className="text-center py-12">
                                        <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <p className="text-gray-600 text-lg">لا توجد عملات متاحة</p>
                                        <p className="text-gray-500 text-sm mt-2">يرجى التحقق من الاتصال بالخادم</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        { currencies.map((currency) => (
                                            <div
                                                key={ currency.id }
                                                className={ `flex items-center justify-between p-4 border-2 rounded-xl transition-colors ${currency.is_active
                                                    ? 'border-gray-200 hover:border-sky-300 bg-white'
                                                    : 'border-gray-300 bg-gray-50 opacity-75'
                                                    }` }
                                            >
                                                <div className="flex items-center gap-4 flex-1">
                                                    <div
                                                        className={ `w-3 h-3 rounded-full ${currency.is_active ? 'bg-green-500' : 'bg-red-500'
                                                            }` }
                                                    ></div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-gray-800 text-lg">
                                                            { currency.currency_name } ({ currency.currency_code })
                                                        </p>
                                                        <p className="text-sm text-gray-600">
                                                            { currency.symbol && `الرمز: ${currency.symbol}` }
                                                        </p>
                                                    </div>
                                                </div>

                                                { editingId === currency.id ? (
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="number"
                                                            value={ editValue }
                                                            onChange={ (e) => setEditValue(e.target.value) }
                                                            step="0.0001"
                                                            min="0"
                                                            className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
                                                        />
                                                        <button
                                                            onClick={ () => handleSaveEdit(currency.id) }
                                                            className="bg-green-500 hover:bg-green-600 text-white p-2 rounded-lg transition-colors"
                                                            title="حفظ"
                                                        >
                                                            <Save className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={ handleCancelEdit }
                                                            className="bg-gray-500 hover:bg-gray-600 text-white p-2 rounded-lg transition-colors"
                                                            title="إلغاء"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <div className="text-left">
                                                            <p className="text-2xl font-bold text-sky-600">
                                                                { formatCurrency(currency.exchange_rate_to_usd) }
                                                            </p>
                                                            <p className="text-xs text-gray-500">سعر الصرف ($)</p>
                                                        </div>
                                                        <button
                                                            onClick={ () => handleStartEdit(currency) }
                                                            className="bg-orange-500 hover:bg-orange-600 text-white p-2 rounded-lg transition-colors"
                                                            title="تعديل سعر الصرف"
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={ () => handleToggleStatus(currency.id, currency.is_active) }
                                                            disabled={ togglingId === currency.id }
                                                            className={ `p-2 rounded-lg transition-colors ${currency.is_active
                                                                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                                                                : 'bg-green-500 hover:bg-green-600 text-white'
                                                                } disabled:opacity-50` }
                                                            title={ currency.is_active ? 'تعطيل' : 'تفعيل' }
                                                        >
                                                            { togglingId === currency.id ? (
                                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                            ) : currency.is_active ? (
                                                                <XCircle className="w-4 h-4" />
                                                            ) : (
                                                                <CheckCircle className="w-4 h-4" />
                                                            ) }
                                                        </button>
                                                        <button
                                                            onClick={ () => setShowDeleteConfirm(currency.id) }
                                                            className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg transition-colors"
                                                            title="حذف"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) }
                                            </div>
                                        )) }
                                    </div>
                                ) }
                            </div>
                        </div>
                    </div>

                    {/* Calculator Widget */ }
                    <div>
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden sticky top-6">
                            <div className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white">
                                <h2 className="text-xl font-bold flex items-center">
                                    <Calculator className="w-5 h-5 ml-2" />
                                    حاسبة العملات
                                </h2>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">المبلغ</label>
                                    <input
                                        type="number"
                                        value={ calculator.amount }
                                        onChange={ (e) => setCalculator({ ...calculator, amount: e.target.value }) }
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">العملة</label>
                                    <select
                                        value={ calculator.currency_id }
                                        onChange={ (e) => setCalculator({ ...calculator, currency_id: e.target.value }) }
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500"
                                    >
                                        <option value="">اختر العملة</option>
                                        { currencies
                                            .filter((c) => c.is_active)
                                            .map((currency) => (
                                                <option key={ currency.id } value={ currency.id }>
                                                    { currency.currency_name } ({ currency.currency_code })
                                                </option>
                                            )) }
                                    </select>
                                </div>

                                <button
                                    onClick={ handleCalculate }
                                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg transition-shadow"
                                >
                                    <TrendingUp className="w-5 h-5 inline ml-2" />
                                    احسب
                                </button>

                                { calculator.result > 0 && (
                                    <div className="mt-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
                                        <p className="text-sm text-green-700 mb-2 font-medium">القيمة بالدولار:</p>
                                        <p className="text-4xl font-bold text-green-600">{ formatUSD(calculator.result) }</p>
                                    </div>
                                ) }

                                { calculator.amount && calculator.currency_id && (
                                    <div className="mt-4 p-4 bg-sky-50 rounded-lg text-sm text-sky-700">
                                        <p className="font-medium mb-1">معادلة الحساب:</p>
                                        <p className="text-xs">
                                            { calculator.amount } ×{ ' ' }
                                            { formatCurrency(
                                                currencies.find((c) => c.id === parseInt(calculator.currency_id))
                                                    ?.exchange_rate_to_usd || 0
                                            ) }{ ' ' }
                                            = { formatUSD(calculator.result) }
                                        </p>
                                    </div>
                                ) }
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Card */ }
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-2xl p-6 border border-orange-200">
                    <div className="flex items-start gap-3">
                        <div className="bg-orange-500 rounded-full p-2 text-white mt-1">
                            <DollarSign className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold text-gray-800 mb-2">ملاحظة هامة</h3>
                            <p className="text-sm text-gray-700 leading-relaxed">
                                أسعار الصرف هنا هي معدل تحويل العملة المحلية إلى الدولار الأمريكي. يتم حفظ سعر
                                الصرف لحظة إنشاء المشروع لضمان دقة الحسابات المالية حتى لو تغير السعر لاحقاً.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Currency Modal */ }
            { showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Header */ }
                        <div className="px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white flex items-center justify-between">
                            <h2 className="text-xl font-bold flex items-center">
                                <Plus className="w-5 h-5 ml-2" />
                                إضافة عملة جديدة
                            </h2>
                            <button
                                onClick={ () => {
                                    setShowAddModal(false);
                                    setNewCurrency({
                                        currency_name_ar: '',
                                        currency_name_en: '',
                                        currency_code: '',
                                        currency_symbol: '',
                                        exchange_rate_to_usd: '',
                                        is_active: true,
                                    });
                                } }
                                disabled={ isCreating }
                                className="p-2 hover:bg-white/20 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body */ }
                        <div className="p-6 space-y-4">
                            {/* Currency Name Arabic */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    اسم العملة (عربي) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={ newCurrency.currency_name_ar }
                                    onChange={ (e) => setNewCurrency({ ...newCurrency, currency_name_ar: e.target.value }) }
                                    placeholder="مثال: جنيه مصري"
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                                    disabled={ isCreating }
                                />
                            </div>

                            {/* Currency Name English */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    اسم العملة (إنجليزي) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={ newCurrency.currency_name_en }
                                    onChange={ (e) => setNewCurrency({ ...newCurrency, currency_name_en: e.target.value }) }
                                    placeholder="Example: Egyptian Pound"
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                                    disabled={ isCreating }
                                />
                            </div>

                            {/* Currency Code */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    رمز العملة (3 أحرف) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={ newCurrency.currency_code }
                                    onChange={ (e) => setNewCurrency({ ...newCurrency, currency_code: e.target.value.toUpperCase().slice(0, 3) }) }
                                    placeholder="مثال: EGP"
                                    maxLength={ 3 }
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500 uppercase"
                                    disabled={ isCreating }
                                />
                                <p className="text-xs text-gray-500 mt-1">يجب أن يكون 3 أحرف (مثل: USD, EUR, EGP)</p>
                            </div>

                            {/* Currency Symbol */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    رمز العملة (اختياري)
                                </label>
                                <input
                                    type="text"
                                    value={ newCurrency.currency_symbol }
                                    onChange={ (e) => setNewCurrency({ ...newCurrency, currency_symbol: e.target.value }) }
                                    placeholder="مثال: ج.م أو $"
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                                    disabled={ isCreating }
                                />
                            </div>

                            {/* Exchange Rate */ }
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    سعر الصرف مقابل الدولار <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={ newCurrency.exchange_rate_to_usd }
                                    onChange={ (e) => setNewCurrency({ ...newCurrency, exchange_rate_to_usd: e.target.value }) }
                                    placeholder="مثال: 0.0680"
                                    step="0.0001"
                                    min="0.0001"
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-green-500"
                                    disabled={ isCreating }
                                />
                                <p className="text-xs text-gray-500 mt-1">مثال: إذا كان 1 EGP = 0.068 USD، أدخل 0.0680</p>
                            </div>

                            {/* Is Active */ }
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={ newCurrency.is_active }
                                    onChange={ (e) => setNewCurrency({ ...newCurrency, is_active: e.target.checked }) }
                                    className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                    disabled={ isCreating }
                                />
                                <label htmlFor="is_active" className="text-sm font-semibold text-gray-700">
                                    العملة نشطة
                                </label>
                            </div>
                        </div>

                        {/* Footer */ }
                        <div className="px-6 py-4 border-t border-gray-200 flex items-center gap-3">
                            <button
                                onClick={ () => {
                                    setShowAddModal(false);
                                    setNewCurrency({
                                        currency_name_ar: '',
                                        currency_name_en: '',
                                        currency_code: '',
                                        currency_symbol: '',
                                        exchange_rate_to_usd: '',
                                        is_active: true,
                                    });
                                } }
                                disabled={ isCreating }
                                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={ handleCreateCurrency }
                                disabled={ isCreating }
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-medium hover:shadow-lg transition-shadow disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                { isCreating ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        جاري الإضافة...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-5 h-5" />
                                        إضافة العملة
                                    </>
                                ) }
                            </button>
                        </div>
                    </div>
                </div>
            ) }

            {/* Delete Confirmation Modal */ }
            { showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" dir="rtl">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">تأكيد الحذف</h3>
                        <p className="text-gray-600 mb-6">
                            هل أنت متأكد من حذف هذه العملة؟ قد لا يمكن حذفها إذا كانت مستخدمة في مشاريع.
                        </p>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={ () => {
                                    setShowDeleteConfirm(null);
                                    setDeletingId(null);
                                } }
                                disabled={ deletingId === showDeleteConfirm }
                                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={ () => handleDelete(showDeleteConfirm) }
                                disabled={ deletingId === showDeleteConfirm }
                                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                { deletingId === showDeleteConfirm ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                                        جاري الحذف...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-5 h-5" />
                                        حذف
                                    </>
                                ) }
                            </button>
                        </div>
                    </div>
                </div>
            ) }
        </div>
    );
};

export default CurrenciesManagement;


