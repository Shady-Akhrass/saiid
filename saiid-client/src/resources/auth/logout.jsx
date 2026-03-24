import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const Logout = () => {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const handleLogout = async () => {
            setIsLoading(true);
            try {
                await logout();
                navigate('/login');
            } catch (error) {
                console.error('حدث خطأ أثناء تسجيل الخروج:', error);
                setIsLoading(false);
            }
        };

        handleLogout();
    }, [logout, navigate]);

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 rtl">
            <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-lg rounded-lg">
                {isLoading ? (
                    <div className="animate-pulse space-y-4">
                        <div className="h-8 bg-gray-200 rounded"></div>
                        <div className="h-8 bg-gray-200 rounded"></div>
                        <div className="h-8 bg-gray-200 rounded"></div>
                    </div>
                ) : (
                    <div>
                        <h2 className="text-2xl font-bold text-center mb-4">جاري تسجيل الخروج...</h2>
                        <p className="text-gray-500 text-center">
                            من فضلك انتظر حتى يتم تسجيل خروجك من النظام.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Logout;