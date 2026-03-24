<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Here you may configure your settings for cross-origin resource sharing
    | or "CORS". This determines what cross-origin operations may execute
    | in web browsers. You are free to adjust these settings as needed.
    |
    | To learn more: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    // يجب أن تتضمن PATCH (تحديث المشروع / عدد المستفيدين) — لا تستخدم '*' هنا
    'allowed_methods' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],


    // ✅ Frontend URLs - أضف جميع الـ origins المطلوبة
    'allowed_origins' => [
        // ✅ Development URLs
        'http://localhost:5173',   // Vite default port
        'http://localhost:5174',   // Current Vite port
        // ✅ Production URLs - Frontend Production Domains
        'https://forms.saiid.org',           // Frontend Production URL
        'https://www.forms.saiid.org',       // Frontend Production URL with www
        'https://saiid.org',                 // Main domain (if needed)
        'https://www.saiid.org',             // Main domain with www (if needed)
    ],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['Content-Type', 'Authorization', 'X-Requested-With', 'Pragma', 'Cache-Control'],

    'exposed_headers' => [
        'Authorization',
        'X-Requested-With',
        'Content-Type',
        'Accept',
        'Origin',
    ],

    'max_age' => 86400, // 24 hours

    'supports_credentials' => true,
];
