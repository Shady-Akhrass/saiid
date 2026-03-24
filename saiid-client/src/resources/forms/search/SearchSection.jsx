import React, { useState } from 'react';
import { Search, AlertCircle } from 'lucide-react';
import { SearchFormSkeleton } from '../skeletons/Skeletons';

const SearchSection = ({
    searchId,
    setSearchId,
    searchOrphanById,
    isSearching,
    onNewRegistration,
    searchLabel = "البحث عن بيانات يتيم مسجل",
    idLabel = "رقم هوية اليتيم",
    searchPlaceholder = "أدخل رقم هوية اليتيم (9 أرقام)",
    searchButtonText = "بحث عن يتيم",
    newRegistrationText = "+ تسجيل يتيم جديد"
}) => {
    const [error, setError] = useState('');

    if (isSearching) {
        return <SearchFormSkeleton />;
    }

    const handleInputChange = (e) => {
        const value = e.target.value;
        
        // Only allow numbers
        const numericValue = value.replace(/[^0-9]/g, '');
        
        // Limit to 9 digits
        const limitedValue = numericValue.slice(0, 9);
        
        setSearchId(limitedValue);
        
        // Validate length
        if (limitedValue.length > 0 && limitedValue.length < 9) {
            setError('رقم الهوية يجب أن يكون 9 أرقام');
        } else {
            setError('');
        }
    };

    const handleSearch = () => {
        if (!searchId.trim()) {
            setError('الرجاء إدخال رقم الهوية');
            return;
        }
        
        if (searchId.length !== 9) {
            setError('رقم الهوية يجب أن يكون 9 أرقام بالضبط');
            return;
        }
        
        setError('');
        searchOrphanById();
    };

    const isValidSearch = searchId.length === 9;

    return (
        <div className="rounded-xl py-6 mb-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Search className="w-6 h-6 text-blue-500" />
                {searchLabel}
            </h2>

            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {idLabel}
                        <span className="text-red-500 mr-1">*</span>
                        <span className="text-gray-500 text-xs mr-2">(9 أرقام)</span>
                    </label>
                    <input
                        type="text"
                        value={searchId}
                        onChange={handleInputChange}
                        placeholder={searchPlaceholder}
                        maxLength={9}
                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors ${
                            error 
                                ? 'border-red-500 focus:ring-red-500' 
                                : 'border-gray-300'
                        }`}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    
                    {/* Character Counter */}
                    <div className="flex items-center justify-between mt-2">
                        {error ? (
                            <div className="flex items-center gap-1 text-sm text-red-600">
                                <AlertCircle className="w-4 h-4" />
                                <span>{error}</span>
                            </div>
                        ) : (
                            <div className="text-sm text-gray-500">
                                {searchId.length > 0 && (
                                    <span className={searchId.length === 9 ? 'text-green-600 font-medium' : ''}>
                                        {searchId.length} / 9
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Primary Action - Search */}
                    <button
                        onClick={handleSearch}
                        disabled={isSearching || !isValidSearch}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed font-semibold group flex-1 sm:flex-initial"
                    >
                        {isSearching ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                جاري البحث...
                            </>
                        ) : (
                            <>
                                <Search className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                {searchButtonText}
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="hidden sm:flex items-center px-2">
                        <span className="text-gray-400 font-medium">أو</span>
                    </div>
                    <div className="sm:hidden flex items-center justify-center">
                        <span className="text-gray-400 font-medium text-sm">أو</span>
                    </div>

                    {/* Secondary Action - New Registration */}
                    <button
                        onClick={onNewRegistration}
                        className="flex items-center justify-center gap-2 px-8 py-3 bg-white text-green-700 border-2 border-green-600 rounded-lg hover:bg-green-600 hover:text-white transition-all font-semibold group flex-1 sm:flex-initial"
                    >
                        <span>{newRegistrationText}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SearchSection;