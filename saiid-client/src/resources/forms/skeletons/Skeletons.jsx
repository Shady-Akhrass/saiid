import React from 'react';

// Base Skeleton Component
export const Skeleton = ({ className = "" }) => (
    <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Initial Page Skeleton
export const InitialPageSkeleton = () => (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center w-full px-4 sm:px-6 lg:px-8" style={{ direction: 'rtl' }}>
        <div className="bg-white shadow-md rounded-xl max-w-2xl w-full mx-auto p-4 px-4 sm:px-6 lg:px-8 py-8 mt-16 mb-10">
            {/* Logo Skeleton */}
            <div className="flex justify-center mb-6">
                <Skeleton className="h-20 w-20 rounded-full" />
            </div>
            
            {/* Title Skeleton */}
            <Skeleton className="h-8 w-64 mx-auto mb-6" />
            
            {/* Search Section Skeleton */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <Skeleton className="h-6 w-48 mb-4" />
                <Skeleton className="h-12 w-full mb-4" />
                <div className="flex gap-4">
                    <Skeleton className="h-12 w-32" />
                    <Skeleton className="h-12 w-40" />
                </div>
            </div>
            
            {/* Content Skeleton */}
            <div className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-5/6" />
            </div>
        </div>
    </div>
);

// Search Form Skeleton
export const SearchFormSkeleton = () => (
    <div className="bg-gradient-to-br from-blue-50 to-orange-50 rounded-xl p-6 mb-6">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-12 w-full mb-4" />
        <div className="flex gap-4">
            <Skeleton className="h-12 w-32" />
            <Skeleton className="h-12 w-40" />
        </div>
    </div>
);

// Orphan Details Card Skeleton
export const OrphanCardSkeleton = () => (
    <div className="bg-white shadow-md rounded-xl p-6">
        <Skeleton className="h-8 w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[...Array(6)].map((_, i) => (
                <div key={i}>
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-6 w-48" />
                </div>
            ))}
        </div>
        <div className="mt-6 flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
        </div>
    </div>
);