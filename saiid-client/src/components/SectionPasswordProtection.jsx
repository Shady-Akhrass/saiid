import React, { useState, useEffect } from 'react';
import { Lock, Eye, EyeOff, Shield, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// كلمات المرور الثابتة لكل قسم
const SECTION_PASSWORDS = {
    orphans: 'orphan2025',
    aids: 'aid2025',
    patients: 'patient2025',
    shelters: 'shelter2025',
    projects: 'shelter2025', // نفس كلمة مرور مراكز النزوح
    students: 'student2025',
    teachers: 'teacher2025',
    employments: 'employment2025',
    statistics: 'stats2025'
};

// مجموعات الأقسام المرتبطة (تفتح معاً)
const LINKED_SECTIONS = {
    shelters: ['shelters', 'projects'], // مراكز النزوح والمشاريع
    projects: ['shelters', 'projects']  // المشاريع ومراكز النزوح
};

const SectionPasswordProtection = ({ sectionName, children, displayName }) => {
    const { user } = useAuth();
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isShaking, setIsShaking] = useState(false);

    // ✅ التحقق من دور منسق المشاريع (جميع الصيغ المحتملة)
    const normalizedRole =
        (typeof (user?.role || user?.role_name || user?.user_role || '') === 'string'
            ? (user?.role || user?.role_name || user?.user_role || '').toLowerCase()
            : '') || '';

    const isProjectCoordinator =
        normalizedRole === 'executed_projects_coordinator' ||
        normalizedRole === 'منسق مشاريع منفذة' ||
        normalizedRole === 'منسق المشاريع المنفذة' ||
        normalizedRole === 'project_coordinator' ||
        normalizedRole === 'منسق المشاريع';

    // ✅ الأقسام التي لا تحتاج كلمة مرور لمنسق المشاريع
    const exemptSections = ['orphans', 'shelters', 'projects'];
    const isExemptForCoordinator = isProjectCoordinator && exemptSections.includes(sectionName);

    // التحقق من الوصول المحفوظ في sessionStorage
    useEffect(() => {
        // ✅ إذا كان منسق المشاريع والأقسام معفاة، فتح مباشرة
        if (isExemptForCoordinator) {
            setIsUnlocked(true);
            return;
        }

        const unlocked = sessionStorage.getItem(`section_unlocked_${sectionName}`);
        if (unlocked === 'true') {
            setIsUnlocked(true);
        }
    }, [sectionName, isExemptForCoordinator]);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (password === SECTION_PASSWORDS[sectionName]) {
            setIsUnlocked(true);

            // فتح القسم الحالي
            sessionStorage.setItem(`section_unlocked_${sectionName}`, 'true');

            // فتح الأقسام المرتبطة إذا وجدت
            if (LINKED_SECTIONS[sectionName]) {
                LINKED_SECTIONS[sectionName].forEach(linkedSection => {
                    sessionStorage.setItem(`section_unlocked_${linkedSection}`, 'true');
                });
            }

            setError('');
        } else {
            setError('كلمة المرور غير صحيحة');
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
            setPassword('');
        }
    };

    const handleLock = () => {
        setIsUnlocked(false);

        // قفل القسم الحالي
        sessionStorage.removeItem(`section_unlocked_${sectionName}`);

        // قفل الأقسام المرتبطة إذا وجدت
        if (LINKED_SECTIONS[sectionName]) {
            LINKED_SECTIONS[sectionName].forEach(linkedSection => {
                sessionStorage.removeItem(`section_unlocked_${linkedSection}`);
            });
        }

        setPassword('');
    };

    // ✅ إذا كان منسق المشاريع والأقسام معفاة، عرض المحتوى مباشرة بدون زر القفل
    if (isExemptForCoordinator) {
        return <>{ children }</>;
    }

    if (isUnlocked) {
        return (
            <div className="relative">
                {/* زر القفل في الزاوية */ }
                <button
                    onClick={ handleLock }
                    className="fixed top-20 left-4 z-50 p-3 bg-gradient-to-br from-orange-400 to-orange-500 text-white rounded-2xl shadow-lg hover:from-orange-500 hover:to-orange-600 transition-all duration-300 hover:scale-110"
                    title="قفل القسم"
                >
                    <Lock className="w-5 h-5" />
                </button>
                { children }
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-white to-orange-50 flex items-center justify-center p-4" dir="rtl">
            {/* Animated Background */ }
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-sky-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
                <div className="absolute top-40 -left-40 w-80 h-80 bg-orange-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
                <div className="absolute -bottom-40 right-40 w-80 h-80 bg-sky-100 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
            </div>

            <div className={ `relative bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 w-full max-w-md transform transition-all duration-300 ${isShaking ? 'animate-shake' : ''}` }>
                {/* Header */ }
                <div className="text-center mb-8">
                    <div className="relative inline-block">
                        <div className="absolute inset-0 bg-gradient-to-r from-sky-400 to-orange-400 rounded-full blur-lg opacity-75"></div>
                        <div className="relative p-4 bg-gradient-to-br from-sky-400 to-orange-400 rounded-full">
                            <Shield className="w-12 h-12 text-white" />
                        </div>
                    </div>
                    <h1 className="mt-6 text-3xl font-bold bg-gradient-to-r from-sky-600 to-sky-400 bg-clip-text text-transparent">
                        قسم محمي
                    </h1>
                    <p className="mt-2 text-gray-600 font-medium text-lg">
                        { displayName || sectionName }
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        يرجى إدخال كلمة المرور للدخول
                    </p>
                </div>

                {/* Error Message */ }
                { error && (
                    <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-center gap-3 animate-fadeIn">
                        <div className="p-2 bg-red-100 rounded-full">
                            <X className="w-5 h-5 text-red-600" />
                        </div>
                        <p className="text-red-700 font-medium">{ error }</p>
                    </div>
                ) }

                {/* Password Form */ }
                <form onSubmit={ handleSubmit } className="space-y-6">
                    <div className="relative">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            كلمة المرور
                        </label>
                        <div className="relative">
                            <input
                                type={ showPassword ? 'text' : 'password' }
                                value={ password }
                                onChange={ (e) => setPassword(e.target.value) }
                                className="w-full px-12 py-4 bg-gray-50 border-2 border-gray-200 rounded-2xl transition-all duration-300 outline-none focus:border-sky-400 focus:bg-white focus:shadow-lg focus:shadow-sky-100 hover:border-sky-300 text-left"
                                placeholder="••••••••"
                                autoFocus
                                required
                            />
                            <Lock className="absolute right-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <button
                                type="button"
                                onClick={ () => setShowPassword(!showPassword) }
                                className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-sky-500 transition-colors duration-300"
                            >
                                { showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" /> }
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full py-4 bg-gradient-to-r from-sky-400 to-sky-500 text-white rounded-2xl font-bold hover:from-sky-500 hover:to-sky-600 transform hover:scale-105 transition-all duration-300 shadow-lg shadow-sky-200 flex items-center justify-center gap-3"
                    >
                        <Shield className="w-5 h-5" />
                        <span>فتح القسم</span>
                    </button>
                </form>

                {/* Info */ }
                <div className="mt-6 p-4 bg-sky-50 border border-sky-200 rounded-xl">
                    <p className="text-xs text-sky-700 text-center">
                        🔒 هذا القسم محمي بكلمة مرور. سيتم فتحه حتى تغلق المتصفح.
                    </p>
                </div>
            </div>

            <style>{ `
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
                    20%, 40%, 60%, 80% { transform: translateX(10px); }
                }
                .animate-shake {
                    animation: shake 0.5s;
                }
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
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out;
                }
            `}</style>
        </div>
    );
};

export default SectionPasswordProtection;

