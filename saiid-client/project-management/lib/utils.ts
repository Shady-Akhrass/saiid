import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

// تنسيق الأرقام بالإنجليزية
export function formatNumber(num: number): string {
    return new Intl.NumberFormat('en-US').format(num)
}

// تنسيق العملة
export function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
    }).format(amount)
}

// تنسيق التاريخ بالعربية
export function formatDate(date: Date | string, format: 'short' | 'long' | 'full' = 'short'): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date

    if (format === 'full') {
        return new Intl.DateTimeFormat('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        }).format(dateObj)
    }

    if (format === 'long') {
        return new Intl.DateTimeFormat('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        }).format(dateObj)
    }

    return new Intl.DateTimeFormat('ar-SA', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(dateObj)
}

// تنسيق التاريخ النسبي (منذ كم من الوقت)
export function formatRelativeTime(date: Date | string): string {
    const dateObj = typeof date === 'string' ? new Date(date) : date
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000)

    if (diffInSeconds < 60) {
        return 'منذ لحظات'
    }

    const diffInMinutes = Math.floor(diffInSeconds / 60)
    if (diffInMinutes < 60) {
        return `منذ ${diffInMinutes} دقيقة`
    }

    const diffInHours = Math.floor(diffInMinutes / 60)
    if (diffInHours < 24) {
        return `منذ ${diffInHours} ساعة`
    }

    const diffInDays = Math.floor(diffInHours / 24)
    if (diffInDays < 30) {
        return `منذ ${diffInDays} يوم`
    }

    const diffInMonths = Math.floor(diffInDays / 30)
    if (diffInMonths < 12) {
        return `منذ ${diffInMonths} شهر`
    }

    const diffInYears = Math.floor(diffInMonths / 12)
    return `منذ ${diffInYears} سنة`
}

