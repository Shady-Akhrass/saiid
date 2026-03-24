import React from 'react';

function ImageProgressBar({ percentage }) {
    return (
        <div id="progress-container" style={{ width: '100%', backgroundColor: '#ddd', marginTop: '20px' }}>
            <div id="progress-bar" style={{ width: `${percentage}%`, height: '30px', backgroundColor: '#4caf50' }}>
                <span id="progress-text" style={{ color: 'white', textAlign: 'center', lineHeight: '30px' }}>{percentage}%</span>
            </div>
        </div>
    );
};


export default ImageProgressBar;