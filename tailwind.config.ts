import type { Config } from 'tailwindcss';

/**
 * TerraScope design tokens.
 *
 * The palette is deliberately narrow: one "void" family for structure, one
 * accent for interaction, and one hue per live data layer so markers stay
 * distinguishable without neon overload.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        void: {
          DEFAULT: '#04060d',
          900: '#05070f',
          800: '#080c17',
          700: '#0c1220',
        },
        ink: {
          DEFAULT: '#e8eef8',
          muted: '#93a3bd',
          faint: '#5d6b85',
        },
        accent: {
          DEFAULT: '#4cc9f0',
          soft: '#8fdff5',
          deep: '#1b6fa8',
        },
        layer: {
          seismic: '#ff8a4c',
          wildfire: '#ff6b3d',
          storm: '#8b9dff',
          volcano: '#ff5d73',
          ice: '#9fd8ff',
          flight: '#7ee787',
          air: '#c084fc',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)'],
        mono: ['var(--font-mono)'],
      },
      boxShadow: {
        panel: '0 24px 70px -32px rgba(0, 0, 0, 0.95)',
        raised: '0 10px 30px -16px rgba(0, 0, 0, 0.9)',
        accent: '0 0 0 1px rgba(76, 201, 240, 0.28), 0 12px 40px -18px rgba(76, 201, 240, 0.45)',
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 480ms ease both',
        'fade-in-slow': 'fadeIn 900ms ease both',
        'slide-up': 'slideUp 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'slide-right': 'slideRight 380ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'pulse-soft': 'pulseSoft 2600ms ease-in-out infinite',
        shimmer: 'shimmer 1800ms linear infinite',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translate3d(0, 14px, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        slideRight: {
          from: { opacity: '0', transform: 'translate3d(18px, 0, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.9' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
