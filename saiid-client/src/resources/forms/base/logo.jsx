import React from 'react';
import LogoImage from '../../../assets/images/logo.jpg';

const Logo = () => (
    <div className="relative w-full h-8">
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <img
                src={LogoImage}
                alt="جمعية ساعد - Saiid Organization Logo"
                className="w-24 h-24 rounded-full border-4 border-white shadow-lg mb-16 hover:scale-105 transition-transform duration-300 ease-in-out object-cover"
            />
        </div>
    </div>
);

export default Logo;