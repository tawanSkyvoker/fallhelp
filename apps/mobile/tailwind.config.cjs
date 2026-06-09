/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './constants/**/*.{js,jsx,ts,tsx}',
    './hooks/**/*.{js,jsx,ts,tsx}',
    './store/**/*.{js,jsx,ts,tsx}',
    './utils/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#16AD78',
        error: '#EF4444',
        gray: {
          700: '#374151', // onSurface
          500: '#6B7280', // onSurfaceVariant equivalent
        },
      },
      fontFamily: {
        sans: ['Kanit', 'System'],
        kanit: ['Kanit'],
      },
    },
  },
  plugins: [],
};
