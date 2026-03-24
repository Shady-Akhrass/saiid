// components/SkeletonLoader.jsx
import React from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css'; // Import the default styles

const SkeletonLoader = () => {
    return (
        <div className="p-4 space-y-4">
            <Skeleton height={40} width={200} />
            <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="flex items-center space-x-4">
                        <Skeleton circle={true} height={60} width={60} />
                        <div className="flex-1 space-y-2">
                            <Skeleton height={20} width={`80%`} />
                            <Skeleton height={16} width={`60%`} />
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex justify-between mt-4">
                <Skeleton height={40} width={100} />
                <Skeleton height={40} width={100} />
            </div>
        </div>

    );
};

export default SkeletonLoader;
