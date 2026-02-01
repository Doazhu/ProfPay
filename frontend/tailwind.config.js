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
        },
        'secondary': {
          DEFAULT: '#5852ED',
          light: '#7a75f1',
          dark: '#4540c9',
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
          DEFAULT: '#E7EBED',
          dark: '#d4d9dc',
          darker: '#c1c8cc',
        },
      },
      fontFamily: {
        sans: ['Rubik', 'system-ui', '-apple-system', 'sans-serif'],
        heading: ['JetBrains Mono', 'monospace'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
