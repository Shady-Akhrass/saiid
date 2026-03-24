import React from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const FormSkeleton = () => {
    return (
        <div className="form-skeleton p-6 bg-white rounded-lg shadow-md max-w-lg mx-auto">
            <div className="text-center mb-4">
                <Skeleton circle={true} height={80} width={80} />
            </div>
            <div className="mb-2">
                <Skeleton height={20} width={`80%`} />
            </div>
            <div className="mb-4">
                <Skeleton height={40} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <Skeleton height={40} />
                <Skeleton height={40} />
            </div>
            <div className="mb-4">
                <Skeleton height={40} />
            </div>
            <div className="mb-4">
                <Skeleton height={40} />
            </div>
            <div className="mb-4">
                <Skeleton height={40} />
            </div>
            <div className="mb-4">
                <Skeleton height={40} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <Skeleton height={40} />
                <Skeleton height={40} />
            </div>
            <div className="mb-4">
                <Skeleton height={120} />
            </div>
            <div className="text-right">
                <Skeleton height={40} width={100} />
            </div>
        </div>
    );
};

export default FormSkeleton;
