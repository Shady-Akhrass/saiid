import { useState, useCallback } from 'react';
import { useToast } from './useToast';
import apiClient from '../utils/axiosConfig';
import axios from 'axios';

const useFetchUserData = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const { error: showError } = useToast();

    const fetchData = useCallback(async (userId) => {
        if (!userId) {
            return;
        }
        
        setLoading(true);
        try {
            const response = await apiClient.get(`/user/${userId}`);
            const data = response.data;
            
            // ✅ التحقق من أن البيانات موجودة
            if (!data || (typeof data === 'string' && data.trim() === '')) {
                // ✅ تجاهل الاستجابات الفارغة بصمت
                if (import.meta.env.DEV) {
                    console.warn('⚠️ Empty response from /user endpoint, ignoring...');
                }
                return;
            }
            
            // ✅ Handle different response formats
            // Format 1: { user: { name, email, ... } }
            // Format 2: { data: { name, email, ... } }
            // Format 3: { name, email, ... } (direct user object)
            const userData = data.user || data.data || data;
            
            if (userData && (userData.name || userData.email)) {
                setName(userData.name || '');
                setEmail(userData.email || '');
            } else {
                // ✅ تجاهل الاستجابات بدون بيانات المستخدم بصمت (قد يكون المستخدم غير موجود)
                if (import.meta.env.DEV) {
                    console.warn('⚠️ User data not found in response, ignoring...', {
                        hasUser: !!data.user,
                        hasData: !!data.data,
                        keys: Object.keys(data || {}),
                    });
                }
                // ✅ لا نرمي خطأ - فقط نتجاهل
                return;
            }
        } catch (error) {
            // ✅ تجاهل CanceledError من Request Deduplication
            if (axios.isCancel && axios.isCancel(error) || error.isCanceled || error.code === 'ERR_CANCELED' || error.name === 'CanceledError') {
                // لا نطبع أو نعرض أي شيء للطلبات الملغاة
                return;
            }
            
            // ✅ تجاهل جميع أخطاء الاتصال والـ timeout و CORS بصمت
            if (error.isConnectionError || error.isTimeoutError || error.isCorsError || 
                error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK') {
                // لا نطبع أو نعرض أي شيء لأخطاء الاتصال
                return;
            }
            
            // ✅ تجاهل أخطاء 401 (unauthorized) و 404 و 500 بصمت
            if (error.response?.status === 401 || error.response?.status === 404 || error.response?.status === 500) {
                // لا نطبع أو نعرض أي شيء لهذه الأخطاء
                return;
            }
            
            // Handle specific database errors from server
            if (error.message?.includes('api_token') || error.message?.includes('Column not found')) {
                if (import.meta.env.DEV) {
                    console.warn('⚠️ Database schema error: api_token column not found. Please check backend configuration.');
                }
                // Don't show toast for database schema errors to avoid spam
                return;
            }
            
            // ✅ تجاهل أخطاء "Invalid response format" بصمت (قد يكون المستخدم غير موجود)
            if (error.message?.includes('Invalid response format') || error.message?.includes('user data not found')) {
                // لا نطبع أو نعرض أي شيء لهذه الأخطاء
                return;
            }
            
            // ✅ تسجيل الأخطاء الأخرى فقط في development
            if (import.meta.env.DEV) {
                console.warn('⚠️ Error fetching user data:', error.message || error);
            }
            
            // Only show toast if it's not a connection/timeout/CORS error and not a 404/401/500
            if (!error.isConnectionError && !error.isTimeoutError && !error.isCorsError && 
                error.response?.status !== 404 && error.response?.status !== 401 && error.response?.status !== 500) {
                showError('حدث خطأ أثناء جلب البيانات من الخادم');
            }
        } finally {
            setLoading(false);
        }
    }, [showError]);

    return { name, setName, email, setEmail, loading, fetchData };
};

export default useFetchUserData;
