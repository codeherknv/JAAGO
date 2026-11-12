/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        asphalt: {
          DEFAULT: '#23272B',
          muted: '#5A626A',
          subtle: '#8C959E',
        },
        kerb: {
          DEFAULT: '#F2F4F3',
          dark: '#E2E6E4',
        },
        border: {
          DEFAULT: '#D9DFE2',
          subtle: '#E7ECEE',
        },
        marking: {
          yellow: '#F2B705',
          hover: '#D9A304',
        },
        signboard: {
          blue: '#0B5D8C',
          light: '#E8F2F8',
        },
        fixed: {
          green: '#1E8E5A',
          light: '#EAF6F0',
        },
        alert: {
          red: '#C8372D',
          light: '#FBEBEA',
        },
        attention: {
          amber: '#D97706',
          light: '#FEF3C7',
        },
      },
      fontFamily: {
        heading: ['var(--font-archivo)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-noto-sans)', 'var(--font-noto-kannada)', 'system-ui', 'sans-serif'],
        kannada: ['var(--font-noto-kannada)', 'sans-serif'],
      },
      borderRadius: {
        plate: '2px',
        control: '8px',
        full: '9999px',
      },
      boxShadow: {
        sheet: '0 -4px 24px rgba(35, 39, 43, 0.12)',
        float: '0 2px 10px rgba(35, 39, 43, 0.14)',
        slider: '0 0 10px rgba(0, 0, 0, 0.30)',
      },
    },
  },
  plugins: [],
};
