import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Route tests sign in as test@example.com; lib/household.ts gates on this list.
    env: { HOUSEHOLD_EMAILS: 'test@example.com' },
  },
  resolve: {
    alias: {
      '@': path.resolve(process.cwd(), '.'),
    },
  },
})
