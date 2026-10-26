import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

// Separate from vite.config.ts so the TanStack Start / nitro plugins stay out of tests.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [viteReact()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
})
