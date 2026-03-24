import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import SkeletonLoader from '../../../components/skeleton';

/**
 * Component لحماية Routes حسب الدور
 * يسمح فقط للمستخدمين بدور supervision أو admin بالوصول
 */
const SupervisionRoute = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        return <SkeletonLoader width="100%" height="100vh" />;
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    // البحث عن role في أماكن مختلفة
    const userRole = user?.role?.toLowerCase?.() ||
        user?.userRole?.toLowerCase?.() ||
        user?.user_role?.toLowerCase?.() ||
        user?.role_name?.toLowerCase?.() ||
        user?.role || '';

    const isSupervision = userRole === 'supervision' ||
        userRole === 'admin' ||
        userRole === 'إشراف' ||
        userRole === 'administrator';

    if (!isSupervision) {
        return <Navigate to="/unauthorized" />;
    }

    return children;
};

export default SupervisionRoute;
