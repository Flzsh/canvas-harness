/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./sidepanel.html', './src/sidepanel/**/*.{ts,tsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        serif: ['Charter', 'Iowan Old Style', 'Georgia', 'Cambria', 'serif'],
      },
      colors: {
        ink: { 50: '#f7f7f8', 100: '#eeeef0', 200: '#dcdce0', 300: '#bdbdc4', 400: '#8e8e99', 500: '#6b6b76', 600: '#52525b', 700: '#3f3f46', 800: '#27272a', 900: '#18181b', 950: '#0f0f11' },
        accent: { 50: '#eef4ff', 100: '#dbe6fe', 200: '#bfd3fe', 300: '#93b4fd', 400: '#608bfa', 500: '#3b66f5', 600: '#2549ea', 700: '#1d38d7', 800: '#1e30ae', 900: '#1e2f89' },
      },
      fontSize: { '2xs': ['10.5px', '14px'] },
    },
  },
  plugins: [],
};
