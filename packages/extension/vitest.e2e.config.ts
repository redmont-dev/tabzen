import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    include: ['e2e/**/*.test.ts'],
    // No jsdom — E2E runs in real browser
    // Run tests sequentially since they share a browser instance
    sequence: {
      concurrent: false,
    },
  },
});
