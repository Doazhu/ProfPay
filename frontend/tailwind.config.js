/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Custom color palette
        'primary': {
          DEFAULT: '#1F9788',
          light: '#2ab8a6',
          dark: '#177a6d',
          50: '#eefaf8',
          100: '#d5f2ee',
        },
        'secondary': {
          DEFAULT: '#5852ED',
          light: '#7a75f1',
          dark: '#4540c9',
          50: '#eeeeff',
          100: '#dddcfe',
        },
        'accent': {
          DEFAULT: '#556084',
          light: '#6b7a9e',
          dark: '#3f4863',
        },
        'dark': {
          DEFAULT: '#1D1A29',
          light: '#2a2640',
          lighter: '#3d3858',
        },
        'light': {
          DEFAULT: '#F0F2F5',
          dark: '#E2E5EA',
          darker: '#CDD2D9',
        },
      },
      fontFamily: {
        sans: ['Rubik', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['JetBrains Mono', 'monospace'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.04)',
        'soft-md': '0 2px 8px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.06)',
        'soft-lg': '0 4px 12px rgba(0,0,0,0.08), 0 12px 32px rgba(0,0,0,0.08)',
        'glow-primary': '0 4px 20px rgba(31,151,136,0.15)',
        'glow-secondary': '0 4px 20px rgba(88,82,237,0.15)',
      },
      // Animation timing functions
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      // Custom keyframe animations
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(-8px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 300ms ease-out',
        'fade-in-fast': 'fade-in 150ms ease-out',
        'fade-in-up': 'fade-in-up 400ms ease-out',
        'scale-in': 'scale-in 200ms ease-out',
        'slide-in-right': 'slide-in-right 200ms ease-out',
      },
    },
  },
  plugins: [],
}
