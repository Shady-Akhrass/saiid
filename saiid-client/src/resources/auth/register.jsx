import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../utils/axiosConfig';

function Register() {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== passwordConfirm) {
            setError('الكلماتان غير متطابقتان');
            return;
        }

        try {
            const response = await apiClient.post('/register', { 
                name, 
                email, 
                password, 
                confirmPassword: passwordConfirm 
            });

            const data = response.data;
            if (data.token && data.user) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));
                navigate('/orphans-statistics');
            } else {
                setError('استجابة غير صحيحة من الخادم');
            }
        } catch (error) {
            console.error('Registration error:', error);
            
            // Handle error response from server
            if (error.response) {
                const errorData = error.response.data;
                if (errorData.errors && errorData.errors.length > 0) {
                    setError(errorData.errors.map(err => err.msg).join(', '));
                } else {
                    setError(errorData.message || error.userMessage || 'فشل التسجيل. يرجى المحاولة مرة أخرى');
                }
            } else if (error.request) {
                setError('حدث خطأ في الاتصال. يرجى التحقق من الاتصال بالإنترنت والمحاولة مرة أخرى');
            } else {
                setError(error.userMessage || 'حدث خطأ غير متوقع');
            }
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100" dir="rtl">
            <div className="w-full max-w-md p-8 space-y-6 bg-white shadow-lg rounded-lg">
                <h2 className="text-2xl font-bold text-center">إنشاء حساب جديد</h2>
                {error && (
                    <div className="p-4 mb-4 text-sm text-red-700 bg-red-100 rounded-lg" role="alert">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-1">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">اسم المستخدم</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            autoComplete='username'
                            placeholder="اسم المستخدم"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring focus:ring-blue-200 focus:border-blue-500"
                        />
                    </div>
                    <div className="space-y-1">
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">البريد الإلكتروني</label>
                        <input
                            type="email"
                            id="email"
                            name="email"
                            placeholder="البريد الإلكتروني"
                            autoComplete='email'
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring focus:ring-blue-200 focus:border-blue-500"
                        />
                    </div>
                    <input
                        type="password"
                        id="password"
                        name="password"
                        placeholder="كلمة المرور"
                        required
                        autocomplete="new-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring focus:ring-blue-200 focus:border-blue-500"
                    />
                    <input
                        type="password"
                        id="passwordConfirm"
                        name="passwordConfirm"
                        placeholder="تأكيد كلمة المرور"
                        required
                        autocomplete="new-password"
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring focus:ring-blue-200 focus:border-blue-500"
                    />
                    <button
                        type="submit"
                        className="w-full px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                    >
                        إنشاء حساب
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Register;
