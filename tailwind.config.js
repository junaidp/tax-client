/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0efff',
          200: '#b9dbff',
          300: '#8cc3ff',
          400: '#57a3ff',
          500: '#2e83ff',
          600: '#1667e6',
          700: '#0f50b4',
          800: '#0e4693',
          900: '#0e3b77',
        },
      },
    },
  },
  plugins: [],
};
