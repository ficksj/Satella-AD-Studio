/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Override zinc with deep cyber black-green shades
        zinc: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#14532d',
          800: '#0f291a',
          900: '#07140c',
          950: '#030905',
        },
        // Map indigo / violet / cyan accents to Matrix Neon Green
        indigo: {
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#4ade80',
          400: '#22c55e',
          500: '#10b981',
          600: '#16a34a',
          700: '#15803d',
          900: '#064e3b',
          950: '#022c22',
        },
        violet: {
          500: '#10b981',
          600: '#059669',
        },
        cyan: {
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
