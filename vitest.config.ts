import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@messages': path.resolve(__dirname, 'messages'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Integration tests share one SQLite file — run files sequentially.
    fileParallelism: false,
    sequence: { concurrent: false },
  },
})
