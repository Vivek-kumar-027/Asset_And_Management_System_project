/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        healthy: {
          light: '#dcfce7',
          DEFAULT: '#10b981',
          dark: '#047857',
        },
        watch: {
          light: '#fef3c7',
          DEFAULT: '#f59e0b',
          dark: '#b45309',
        },
        critical: {
          light: '#ffe4e6',
          DEFAULT: '#f43f5e',
          dark: '#be123c',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
