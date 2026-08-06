import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Deep navy \u2014 used for headers, text, and primary UI chrome
        brand: {
          50: '#eef1f7',
          100: '#dbe2ee',
          400: '#3d5480',
          600: '#1b2f57',
          700: '#142544',
          800: '#0f1e38',
          900: '#0a1526',
        },
        // Warm gold/amber \u2014 the signature accent color for CTAs and highlights
        gold: {
          300: '#efd9a3',
          400: '#e3bd6a',
          500: '#d4a13d',
          600: '#b8872b',
          700: '#966e22',
        },
      },
      fontFamily: {
        heading: ['var(--font-heading)', 'ui-sans-serif', 'system-ui'],
      },
    },
  },
  plugins: [],
};

export default config;

