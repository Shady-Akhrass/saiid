import React from 'react';

const Skeleton = ({ width, height }) => {
    const style = {
        width: width || '100%',
        height: height || '20px',
    };

    return (
        <div
            style={style}
            className="bg-gray-300 animate-pulse rounded"
        ></div>
    );
};

export default Skeleton;
