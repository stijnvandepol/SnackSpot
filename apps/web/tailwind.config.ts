import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        snack: {
          primary: 'var(--snack-primary)',
          accent: 'var(--snack-accent)',
          rating: 'var(--snack-rating)',
          border: 'var(--snack-border)',
          background: 'var(--snack-bg)',
          surface: 'var(--snack-surface)',
          text: 'var(--snack-text)',
          muted: 'var(--snack-muted)',
        },
      },
      fontFamily: {
        heading: ['var(--font-poppins)', 'var(--font-inter)', 'system-ui', 'sans-serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
