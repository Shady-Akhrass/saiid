import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';
import useFetchUserData from '../../hooks/fetchUser.jsx';
import { User, Mail, Lock, Save, Eye, EyeOff, Shield, ArrowRight, Check, AlertCircle } from 'lucide-react';
import apiClient from '../../utils/axiosConfig';

function EditRegistration() {
    const { userId } = useParams();
    const navigate = useNavigate();
    const { success, error: showError } = useToast();
    const [password, setPassword] = useState('');
    const [passwordConfirm, setPasswordConfirm] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
    const [activeSection, setActiveSection] = useState('profile');
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [focusedField, setFocusedField] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    const { name, setName, email, setEmail, loading, fetchData } = useFetchUserData();

    useEffect(() => {
        fetchData(userId);
    }, [userId, fetchData]);

    // Password strength checker
    useEffect(() => {
        if (!password) {
            setPasswordStrength(0);
            return;
        }
        
        let strength = 0;
        if (password.length >= 8) strength++;
        if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
        if (password.match(/[0-9]/)) strength++;
        if (password.match(/[^a-zA-Z0-9]/)) strength++;
        
        setPasswordStrength(strength);
    }, [password]);

    const getPasswordStrengthColor = () => {
        switch(passwordStrength) {
            case 0: return 'bg-gray-300';
            case 1: return 'bg-red-400';
            case 2: return 'bg-orange-400';
            case 3: return 'bg-yellow-400';
            case 4: return 'bg-green-400';
            default: return 'bg-gray-300';
        }
    };

    const getPasswordStrengthText = () => {
        switch(passwordStrength) {
            case 0: return '';
            case 1: return 'ضعيفة';
            case 2: return 'متوسطة';
            case 3: return 'جيدة';
            case 4: return 'قوية';
            default: return '';
        }
    };

    const handleEmailUpdate = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const response = await apiClient.patch(`/register/${userId}`, { email });
            const updatedUser = response.data;
            
            if (updatedUser.email) {
                setEmail(updatedUser.email);
                success('تم تحديث البريد الإلكتروني بنجاح');
            } else {
                throw new Error('استجابة غير صحيحة من الخادم');
            }
        } catch (error) {
            console.error('Error updating email:', error);
            const errorMessage = error.response?.data?.message || error.userMessage || 'فشل تحديث البريد الإلكتروني';
            showError(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        if (password !== passwordConfirm) {
            showError('الكلمتان غير متطابقتين');
            return;
        }

        if (passwordStrength < 2) {
            showError('كلمة المرور ضعيفة جداً. يرجى اختيار كلمة مرور أقوى');
            return;
        }

        setIsSaving(true);
        try {
            await apiClient.patch(`/register/${userId}`, { password });
            
            success('تم تحديث كلمة المرور بنجاح');
            setPassword('');
            setPasswordConfirm('');
            setPasswordStrength(0);
        } catch (error) {
            console.error('Error updating password:', error);
            const errorMessage = error.response?.data?.message || error.userMessage || 'فشل تحديث كلمة المرور';
            showError(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const response = await apiClient.patch(`/register/${userId}`, { name });
            const updatedUser = response.data;
            
            if (updatedUser.name) {
                setName(updatedUser.name);
                success('تم تحديث الملف الشخصي بنجاح');
            } else {
                throw new Error('استجابة غير صحيحة من الخادم');
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            const errorMessage = error.response?.data?.message || error.userMessage || 'فشل تحديث الملف الشخصي';
            showError(errorMessage);
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-sky-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">جاري التحميل...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 py-8 px-4 sm:px-6 lg:px-8" dir="rtl">
            {/* Animated Background Elements */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
                <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-40 right-40 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
            </div>
            
            <div className="relative max-w-5xl mx-auto">
                {/* Header */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => navigate(-1)}
                                className="p-3 bg-gradient-to-br from-sky-100 to-orange-100 rounded-2xl hover:from-sky-200 hover:to-orange-200 transition-all duration-300 group"
                            >
                                <ArrowRight className="w-5 h-5 text-sky-600 group-hover:translate-x-1 transition-transform duration-300" />
                            </button>
                            <div>
                                <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                                    إعدادات الحساب
                                </h1>
                                <p className="text-gray-600 mt-1">قم بإدارة معلوماتك الشخصية وأمان حسابك</p>
                            </div>
                        </div>
                        <div className="hidden lg:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-100 to-green-200 rounded-2xl">
                            <Check className="w-5 h-5 text-green-600" />
                            <span className="text-green-700 font-medium">حساب مُفعّل</span>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-2 mb-6 flex flex-wrap gap-2">
                    {[
                        { id: 'profile', label: 'الملف الشخصي', icon: User },
                        { id: 'email', label: 'البريد الإلكتروني', icon: Mail },
                        { id: 'password', label: 'كلمة المرور', icon: Lock },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveSection(tab.id)}
                            className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-2xl font-medium transition-all duration-300 ${
                                activeSection === tab.id
                                    ? 'bg-gradient-to-r from-sky-400 to-sky-500 text-white shadow-lg shadow-sky-200'
                                    : 'text-gray-600 hover:bg-sky-50 hover:text-sky-600'
                            }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Profile Information Section */}
                {activeSection === 'profile' && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 transform transition-all duration-500 animate-fadeIn">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-gradient-to-br from-sky-400 to-sky-500 rounded-2xl shadow-lg shadow-sky-200">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">معلومات الملف الشخصي</h2>
                                <p className="text-gray-600 text-sm">قم بتحديث معلوماتك الشخصية</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handleProfileUpdate} className="space-y-6">
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
                                <div className={`relative transition-all duration-300 ${focusedField === 'name' ? 'transform scale-105' : ''}`}>
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        onFocus={() => setFocusedField('name')}
                                        onBlur={() => setFocusedField(null)}
                                        className={`w-full px-12 py-4 bg-gray-50 border-2 rounded-2xl transition-all duration-300 outline-none
                                            ${focusedField === 'name' 
                                                ? 'border-sky-400 bg-white shadow-lg shadow-sky-100' 
                                                : 'border-gray-200 hover:border-sky-300'}`}
                                        required
                                    />
                                    <User className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors duration-300
                                        ${focusedField === 'name' ? 'text-sky-500' : 'text-gray-400'}`} />
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className={`w-full py-4 rounded-2xl font-bold text-white transition-all duration-300 transform flex items-center justify-center gap-3
                                    ${isSaving 
                                        ? 'bg-gray-400 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-sky-400 to-sky-500 hover:from-sky-500 hover:to-sky-600 hover:scale-105 hover:shadow-xl active:scale-100'}`}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>جاري الحفظ...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        <span>حفظ التغييرات</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Email Information Section */}
                {activeSection === 'email' && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 transform transition-all duration-500 animate-fadeIn">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl shadow-lg shadow-orange-200">
                                <Mail className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">البريد الإلكتروني</h2>
                                <p className="text-gray-600 text-sm">قم بتحديث عنوان بريدك الإلكتروني</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handleEmailUpdate} className="space-y-6">
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">البريد الإلكتروني</label>
                                <div className={`relative transition-all duration-300 ${focusedField === 'email' ? 'transform scale-105' : ''}`}>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onFocus={() => setFocusedField('email')}
                                        onBlur={() => setFocusedField(null)}
                                        className={`w-full px-12 py-4 bg-gray-50 border-2 rounded-2xl transition-all duration-300 outline-none
                                            ${focusedField === 'email' 
                                                ? 'border-orange-400 bg-white shadow-lg shadow-orange-100' 
                                                : 'border-gray-200 hover:border-orange-300'}`}
                                        required
                                    />
                                    <Mail className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors duration-300
                                        ${focusedField === 'email' ? 'text-orange-500' : 'text-gray-400'}`} />
                                </div>
                                <p className="mt-2 text-xs text-gray-500 flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    سيتم إرسال رسالة تأكيد إلى البريد الإلكتروني الجديد
                                </p>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving}
                                className={`w-full py-4 rounded-2xl font-bold text-white transition-all duration-300 transform flex items-center justify-center gap-3
                                    ${isSaving 
                                        ? 'bg-gray-400 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-orange-400 to-orange-500 hover:from-orange-500 hover:to-orange-600 hover:scale-105 hover:shadow-xl active:scale-100'}`}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>جاري الحفظ...</span>
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-5 h-5" />
                                        <span>تحديث البريد الإلكتروني</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Password Update Section */}
                {activeSection === 'password' && (
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8 transform transition-all duration-500 animate-fadeIn">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-gradient-to-br from-purple-400 to-purple-500 rounded-2xl shadow-lg shadow-purple-200">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">تغيير كلمة المرور</h2>
                                <p className="text-gray-600 text-sm">قم بتعيين كلمة مرور قوية لحماية حسابك</p>
                            </div>
                        </div>
                        
                        <form onSubmit={handlePasswordUpdate} className="space-y-6">
                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور الجديدة</label>
                                <div className={`relative transition-all duration-300 ${focusedField === 'password' ? 'transform scale-105' : ''}`}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onFocus={() => setFocusedField('password')}
                                        onBlur={() => setFocusedField(null)}
                                        className={`w-full px-12 py-4 bg-gray-50 border-2 rounded-2xl transition-all duration-300 outline-none
                                            ${focusedField === 'password' 
                                                ? 'border-purple-400 bg-white shadow-lg shadow-purple-100' 
                                                : 'border-gray-200 hover:border-purple-300'}`}
                                        required
                                    />
                                    <Lock className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors duration-300
                                        ${focusedField === 'password' ? 'text-purple-500' : 'text-gray-400'}`} />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-500 transition-colors duration-300"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                
                                {/* Password Strength Indicator */}
                                {password && (
                                    <div className="mt-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs text-gray-500">قوة كلمة المرور</span>
                                            <span className={`text-xs font-medium ${
                                                passwordStrength >= 3 ? 'text-green-600' : 
                                                passwordStrength >= 2 ? 'text-yellow-600' : 'text-red-600'
                                            }`}>{getPasswordStrengthText()}</span>
                                        </div>
                                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                            <div className={`h-full transition-all duration-500 ${getPasswordStrengthColor()}`} 
                                                style={{ width: `${(passwordStrength / 4) * 100}%` }}></div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="relative">
                                <label className="block text-sm font-medium text-gray-700 mb-2">تأكيد كلمة المرور</label>
                                <div className={`relative transition-all duration-300 ${focusedField === 'passwordConfirm' ? 'transform scale-105' : ''}`}>
                                    <input
                                        type={showPasswordConfirm ? 'text' : 'password'}
                                        value={passwordConfirm}
                                        onChange={(e) => setPasswordConfirm(e.target.value)}
                                        onFocus={() => setFocusedField('passwordConfirm')}
                                        onBlur={() => setFocusedField(null)}
                                        className={`w-full px-12 py-4 bg-gray-50 border-2 rounded-2xl transition-all duration-300 outline-none
                                            ${focusedField === 'passwordConfirm' 
                                                ? 'border-purple-400 bg-white shadow-lg shadow-purple-100' 
                                                : 'border-gray-200 hover:border-purple-300'}
                                            ${password && passwordConfirm && password !== passwordConfirm 
                                                ? 'border-red-400' : ''}`}
                                        required
                                    />
                                    <Lock className={`absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 transition-colors duration-300
                                        ${focusedField === 'passwordConfirm' ? 'text-purple-500' : 'text-gray-400'}`} />
                                    <button
                                        type="button"
                                        onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                                        className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-purple-500 transition-colors duration-300"
                                    >
                                        {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                                
                                {/* Password Match Indicator */}
                                {password && passwordConfirm && (
                                    <div className={`mt-2 flex items-center gap-2 text-sm ${
                                        password === passwordConfirm ? 'text-green-600' : 'text-red-600'
                                    }`}>
                                        {password === passwordConfirm ? (
                                            <>
                                                <Check className="w-4 h-4" />
                                                <span>كلمات المرور متطابقة</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="w-4 h-4" />
                                                <span>كلمات المرور غير متطابقة</span>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Security Tips */}
                            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-4 border border-purple-200">
                                <h3 className="text-sm font-medium text-purple-800 mb-2 flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    نصائح لكلمة مرور قوية
                                </h3>
                                <ul className="text-xs text-purple-700 space-y-1 mr-6">
                                    <li>• استخدم 8 أحرف على الأقل</li>
                                    <li>• امزج بين الأحرف الكبيرة والصغيرة</li>
                                    <li>• أضف أرقاماً ورموزاً خاصة</li>
                                    <li>• تجنب المعلومات الشخصية</li>
                                </ul>
                            </div>

                            <button
                                type="submit"
                                disabled={isSaving || passwordStrength < 2 || password !== passwordConfirm}
                                className={`w-full py-4 rounded-2xl font-bold text-white transition-all duration-300 transform flex items-center justify-center gap-3
                                    ${isSaving || passwordStrength < 2 || password !== passwordConfirm
                                        ? 'bg-gray-400 cursor-not-allowed' 
                                        : 'bg-gradient-to-r from-purple-400 to-purple-500 hover:from-purple-500 hover:to-purple-600 hover:scale-105 hover:shadow-xl active:scale-100'}`}
                            >
                                {isSaving ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>جاري الحفظ...</span>
                                    </>
                                ) : (
                                    <>
                                        <Shield className="w-5 h-5" />
                                        <span>تحديث كلمة المرور</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}
            </div>

            <style>{`
                @keyframes blob {
                    0% { transform: translate(0px, 0px) scale(1); }
                    33% { transform: translate(30px, -50px) scale(1.1); }
                    66% { transform: translate(-20px, 20px) scale(0.9); }
                    100% { transform: translate(0px, 0px) scale(1); }
                }
                .animate-blob {
                    animation: blob 7s infinite;
                }
                .animation-delay-2000 {
                    animation-delay: 2s;
                }
                .animation-delay-4000 {
                    animation-delay: 4s;
                }
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.5s ease-out;
                }
            `}</style>
        </div>
    );
}

export default EditRegistration;