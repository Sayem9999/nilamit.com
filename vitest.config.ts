import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node', // Use 'jsdom' for component tests
    globals: true,
    // setupFiles intentionally omitted — tests/setup.ts not yet created.
    // Add `setupFiles: ['./tests/setup.ts']` once a real setup is needed.
    // tests/e2e/** are Playwright specs; they have a separate runner and
    // import from '@playwright/test' which vitest cannot resolve.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/.claude/**',
      '**/tests/e2e/**',
      '**/scratch/**',
    ],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
