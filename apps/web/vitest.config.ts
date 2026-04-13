import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // Default: node environment for .test.ts lib files.
    // Component tests (.test.tsx) opt in via // @vitest-environment jsdom at top of file.
    environment: 'node',

    // Only pick up *.test.{ts,tsx} — Playwright *.spec.ts files live in e2e/ and are
    // run via `playwright test`, not via vitest.
    include: ['**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', 'e2e/**'],

    // Expose expect/describe/it etc. as globals so @testing-library/jest-dom
    // can call expect.extend() when it is imported in component test files.
    globals: true,

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
      },
    },
  },
})
