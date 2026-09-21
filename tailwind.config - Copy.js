/** @type {import('tailwindcss').Config} */

// Every brand colour is a CSS custom property holding space-separated RGB
// channels, so admin-configured colours work with Tailwind opacity modifiers
// (e.g. bg-primary/10) and change at runtime without a rebuild.
const channel = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: channel('--color-primary'),
          dark: channel('--color-primary-dark'),
          light: channel('--color-primary-light'),
        },
        accent: {
          DEFAULT: channel('--color-accent'),
          dark: channel('--color-accent-dark'),
        },
        secondary: channel('--color-secondary'),
        canvas: channel('--color-bg'),
        surface: channel('--color-surface'),
        ink: {
          DEFAULT: channel('--color-text'),
          muted: channel('--color-text-muted'),
        },
        line: channel('--color-border'),
        success: channel('--color-success'),
        warning: channel('--color-warning'),
        danger: channel('--color-danger'),
        info: channel('--color-info'),
      },
      fontFamily: {
        display: ['"Archivo Expanded"', 'Archivo', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        // Type scale: 1.25 ratio, tightened at display sizes.
        'display-lg': ['3.5rem', { lineHeight: '1.02', letterSpacing: '-0.03em', fontWeight: '700' }],
        display: ['2.5rem', { lineHeight: '1.06', letterSpacing: '-0.025em', fontWeight: '700' }],
        'display-sm': ['1.9rem', { lineHeight: '1.12', letterSpacing: '-0.02em', fontWeight: '700' }],
      },
      borderRadius: {
        card: '14px',
        panel: '20px',
      },
      boxShadow: {
        card: '0 1px 2px rgb(10 31 68 / 0.04), 0 8px 24px -12px rgb(10 31 68 / 0.14)',
        lift: '0 2px 4px rgb(10 31 68 / 0.06), 0 18px 40px -16px rgb(10 31 68 / 0.24)',
        inset: 'inset 0 1px 0 rgb(255 255 255 / 0.06)',
      },
      maxWidth: { prose: '68ch' },
      keyframes: {
        'slide-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'route-dash': { to: { strokeDashoffset: '-24' } },
      },
      animation: {
        'slide-up': 'slide-up .22s cubic-bezier(.2,.8,.3,1)',
        'fade-in': 'fade-in .16s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'route-dash': 'route-dash 1s linear infinite',
      },
    },
  },
  plugins: [],
};
