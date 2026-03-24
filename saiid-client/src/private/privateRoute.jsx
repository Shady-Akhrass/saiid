import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SkeletonLoader from '../components/skeleton';

const PrivateRoute = ({ element }) => {
    const auth = useAuth();
    const location = useLocation();

    // ✅ useAuth الآن يرجع قيمة افتراضية دائماً، لكن نتحقق من loading
    const { isAuthenticated, loading } = auth || { isAuthenticated: false, loading: true };

    if (loading) {
        return <SkeletonLoader width="100%" height="100vh" />;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} />;
    }

    return element;
};

export default PrivateRoute;