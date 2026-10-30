/** @type {import('tailwindcss').Config} */
const sharedNeutralPalette = {
  50: '#f8faf9',
  100: '#f1f5f3',
  200: '#e2e8e5',
  300: '#cbd5d0',
  400: '#94a39b',
  500: '#64746c',
  600: '#47554e',
  700: '#28322d',
  800: '#1b221f',
  900: '#111614',
  950: '#0a0d0c',
};

const brandEmeraldPalette = {
  50: '#ecfdf5',
  100: '#d1fae5',
  200: '#a7f3d0',
  300: '#6ee7b7',
  400: '#34d399',
  500: '#10b981',
  600: '#059669',
  700: '#047857',
  800: '#065f46',
  900: '#064e3b',
  950: '#022c22',
};

export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Eye-friendly matte carbon-obsidian surfaces & crisp neutral-sage text
        zinc: sharedNeutralPalette,
        slate: sharedNeutralPalette,
        // Intentional, refined Emerald accent for buttons, active states & highlights
        brand: brandEmeraldPalette,
        indigo: brandEmeraldPalette,
        violet: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI Variable Display', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      gridTemplateColumns: {
        24: 'repeat(24, minmax(0, 1fr))',
      },
    },
  },
  plugins: [],
}
