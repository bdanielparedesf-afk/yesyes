/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF8FA',
          100: '#FAD3E7',
          200: '#F8C8DD',
          300: '#F0A8C5',
          400: '#E8A0BF',
          500: '#E8A0BF',
          600: '#BA90C6',
          700: '#9F75A8',
          800: '#845A80',
        },
        secondary: '#BA90C6',
        background: '#FFF8FA',
        text: '#4A2C3A',
        border: '#FAD3E7',
        accent: '#C0DBEA',
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        outfit: ['Outfit', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
