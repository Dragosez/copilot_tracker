/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        github: {
          dark: '#0d1117',
          border: '#30363d',
          text: '#c9d1d9',
          accent: '#238636',
          blue: '#1f6feb'
        }
      }
    },
  },
  plugins: [],
}
