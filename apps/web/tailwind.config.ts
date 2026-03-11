import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        snack: {
          primary: '#F97316',
          accent: '#DC2626',
          rating: '#F59E0B',
          border: '#E5E7EB',
          background: '#FFFFFF',
          surface: '#F6F7F9',
          text: '#0F172A',
          muted: '#64748B',
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
