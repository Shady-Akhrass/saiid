// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ✅ تحسين PurgeCSS (مدمج في Tailwind 3.x)
  // Tailwind 3.x يستخدم JIT mode تلقائياً ويحذف CSS غير المستخدم
  // لا حاجة لإعدادات إضافية - يعمل تلقائياً
  theme: {
    extend: {
      fontFamily: {
        'cairo': ['Cairo', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-slow': 'bounce 2s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      }
    },
  },
  plugins: [],
}